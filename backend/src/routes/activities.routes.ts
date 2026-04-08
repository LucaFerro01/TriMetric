import { Router, Request, Response } from 'express';
import { db } from '../db';
import { activities, streamData } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseFitFile, parseGpxFile } from '../services/fitgpx.service';
import { aggregateDailyMetrics } from '../services/metrics.service';

const router = Router();
const upload = multer({ dest: 'uploads/' });

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

// GET /activities
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { from, to, type, limit = '50', offset = '0' } = req.query as Record<string, string>;

  const conditions = [eq(activities.userId, userId)];
  if (from) conditions.push(gte(activities.startTime, from));
  if (to) conditions.push(lte(activities.startTime, to));
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
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '365d' ? 365 : 30;
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

// POST /activities/upload - FIT or GPX file upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  let parsed;

  try {
    if (ext === '.fit') {
      parsed = await parseFitFile(req.file.path);
    } else if (ext === '.gpx') {
      parsed = await parseGpxFile(req.file.path);
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Unsupported file type. Use .fit or .gpx' });
    }
  } catch (err) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Failed to parse file', details: String(err) });
  } finally {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }

  const [activity] = await db.insert(activities).values({
    userId,
    source: ext === '.fit' ? 'fit' : 'gpx',
    activityType: parsed.activityType,
    startTime: parsed.startTime.toISOString(),
    duration: Math.round(parsed.duration),
    distance: parsed.distance,
    elevationGain: parsed.elevationGain,
    avgHeartRate: parsed.avgHeartRate,
    maxHeartRate: parsed.maxHeartRate,
    avgPower: parsed.avgPower,
    calories: parsed.calories,
    rawData: parsed.rawData,
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
