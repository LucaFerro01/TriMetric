import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db';
import { activities, streamData, users } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import multer from 'multer';
import fs from 'fs';
import { parseFitFile, parseGpxFile } from '../services/fitgpx.service';
import { aggregateDailyMetrics } from '../services/metrics.service';
import { estimateCaloriesBurned } from '../services/metrics.service';
import { syncStravaActivities } from '../services/strava.service';

const router: Router = Router();
const upload = multer({ dest: 'uploads/' });

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached, please try again later' },
});

function getUserId(req: Request): string | null {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

function normalizeDateBoundary(value: string, boundary: 'start' | 'end'): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

// GET /activities
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { from, to, type, limit = '50', offset = '0' } = req.query as Record<string, string>;

  const conditions = [eq(activities.userId, userId)];
  if (from) conditions.push(gte(activities.startTime, normalizeDateBoundary(from, 'start')));
  if (to) conditions.push(lte(activities.startTime, normalizeDateBoundary(to, 'end')));
  if (type) conditions.push(eq(activities.activityType, type));

  const rows = await db.select().from(activities)
    .where(and(...conditions))
    .orderBy(desc(activities.startTime))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  return res.json(rows);
});

// GET /activities/summary
router.get('/summary', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { period = '30d' } = req.query as { period?: string };
  const days = period === '1d'
    ? 1
    : period === '7d'
      ? 7
      : period === '30d'
        ? 30
        : period === '90d'
          ? 90
          : period === '180d'
            ? 180
            : period === '365d'
              ? 365
              : 30;
  const from = new Date();
  from.setDate(from.getDate() - days);

  const rows = await db.select({
    activityType: activities.activityType,
    count: sql<number>`count(*)`,
    totalDistance: sql<number>`sum(${activities.distance})`,
    totalDuration: sql<number>`sum(${activities.duration})`,
    totalCalories: sql<number>`sum(${activities.calories})`,
    avgHeartRate: sql<number>`avg(${activities.avgHeartRate})`,
  })
    .from(activities)
    .where(and(eq(activities.userId, userId), gte(activities.startTime, from.toISOString())))
    .groupBy(activities.activityType);

  return res.json(rows);
});

// GET /activities/:id
router.get('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const [activity] = await db.select().from(activities)
    .where(and(eq(activities.id, req.params.id), eq(activities.userId, userId)));

  if (!activity) return res.status(404).json({ error: 'Not found' });

  const [streams] = await db.select().from(streamData).where(eq(streamData.activityId, req.params.id));

  return res.json({ ...activity, streams: streams || null });
});

// DELETE /activities/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  await db.delete(activities)
    .where(and(eq(activities.id, req.params.id), eq(activities.userId, userId)));

  return res.json({ success: true });
});

// POST /activities/strava/sync - Import all historical Strava activities
router.post('/strava/sync', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const count = await syncStravaActivities(userId);
    return res.json({ synced: count });
  } catch (err) {
    console.error('[StravaSync] Failed:', err);
    return res.status(500).json({ error: 'Sync failed', details: String(err) });
  }
});

// POST /activities/upload - FIT or GPX file upload
router.post('/upload', uploadLimiter, upload.single('file'), async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'No file' });

  // Sanitize extension from originalname — extract only final .ext, allow only .fit/.gpx
  const safeExt = (req.file.originalname.match(/\.[a-z]+$/i)?.[0] || '').toLowerCase();
  // req.file.path is multer-generated (random filename in uploads/ dir) — safe to use directly
  const uploadedPath = req.file.path;
  let parsed;

  try {
    if (safeExt === '.fit') {
      parsed = await parseFitFile(uploadedPath);
    } else if (safeExt === '.gpx') {
      parsed = await parseGpxFile(uploadedPath);
    } else {
      fs.unlinkSync(uploadedPath);
      return res.status(400).json({ error: 'Unsupported file type. Use .fit or .gpx' });
    }
  } catch (err) {
    fs.unlinkSync(uploadedPath);
    return res.status(400).json({ error: 'Failed to parse file', details: String(err) });
  } finally {
    if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const estimatedCalories = parsed.calories ?? estimateCaloriesBurned(parsed.activityType, Math.round(parsed.duration), user?.weight);

  const [activity] = await db.insert(activities).values({
    userId,
    source: safeExt === '.fit' ? 'fit' : 'gpx',
    activityType: parsed.activityType,
    startTime: parsed.startTime.toISOString(),
    duration: Math.round(parsed.duration),
    distance: parsed.distance,
    elevationGain: parsed.elevationGain,
    avgHeartRate: parsed.avgHeartRate,
    maxHeartRate: parsed.maxHeartRate,
    avgPower: parsed.avgPower,
    calories: estimatedCalories,
    rawData: {
      ...parsed.rawData,
      caloriesEstimated: parsed.calories == null,
      caloriesSource: parsed.calories != null ? 'file' : 'estimated',
    },
  }).returning();

  if (parsed.streams && Object.keys(parsed.streams).length > 0) {
    await db.insert(streamData).values({
      activityId: activity.id,
      time: parsed.streams.time || null,
      heartrate: parsed.streams.heartrate || null,
      power: parsed.streams.power || null,
      cadence: parsed.streams.cadence || null,
      altitude: parsed.streams.altitude || null,
      latlng: parsed.streams.latlng || null,
    });
  }

  await aggregateDailyMetrics(userId, parsed.startTime);

  return res.status(201).json(activity);
});

export default router;
