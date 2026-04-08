import { Router, Request, Response } from 'express';
import { db } from '../db';
import { metrics, activities, users } from '../db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { estimateVO2MaxRun, estimateFTP, calculateTDEE, calculateCaloriesMET } from '../services/metrics.service';

const router = Router();

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

// GET /metrics - get metrics history
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { days = '90' } = req.query as { days?: string };
  const from = new Date();
  from.setDate(from.getDate() - parseInt(days));

  const rows = await db.select().from(metrics)
    .where(and(eq(metrics.userId, userId), gte(metrics.date, from.toISOString().split('T')[0])))
    .orderBy(desc(metrics.date));

  return res.json(rows);
});

// GET /metrics/vo2max - estimated VO2max from recent runs
router.get('/vo2max', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const runs = await db.select().from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.activityType, 'run')))
    .orderBy(desc(activities.startTime))
    .limit(20);

  const estimates = runs
    .filter((r) => r.distance && r.duration && r.distance > 1000)
    .map((r) => ({
      date: r.startTime,
      vo2max: estimateVO2MaxRun(r.distance!, r.duration!),
      activityId: r.id,
    }));

  return res.json(estimates);
});

// GET /metrics/ftp - estimated FTP from cycling activities
router.get('/ftp', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Get recent rides with power data
  const rides = await db.select().from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.activityType, 'ride')))
    .orderBy(desc(activities.startTime))
    .limit(10);

  const rideWithPower = rides.filter((r) => r.avgPower && r.avgPower > 0);

  if (rideWithPower.length === 0) {
    return res.json({ ftp: null, message: 'No power data available' });
  }

  // Use best 20-min avg power from recent rides
  const maxAvgPower = Math.max(...rideWithPower.map((r) => r.avgPower!));
  const ftp = Math.round(maxAvgPower * 0.95);

  return res.json({ ftp, basedOnRides: rideWithPower.length });
});

// GET /metrics/tdee
router.get('/tdee', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.weight || !user.height || !user.birthDate) {
    return res.json({ tdee: null, message: 'Profile incomplete (need weight, height, birth date)' });
  }

  const ageYears = Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
  // Default to male Mifflin-St Jeor; users can refine via manual metric updates
  const tdee = calculateTDEE(user.weight, user.height, ageYears, true);

  return res.json({ tdee, weight: user.weight, height: user.height, age: ageYears });
});

// GET /metrics/weekly - weekly aggregation
router.get('/weekly', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { weeks = '12' } = req.query as { weeks?: string };
  const from = new Date();
  from.setDate(from.getDate() - parseInt(weeks) * 7);

  const rows = await db.select({
    week: sql<string>`to_char(date_trunc('week', ${activities.startTime}), 'YYYY-WW')`,
    activityType: activities.activityType,
    count: sql<number>`count(*)`,
    totalDistance: sql<number>`sum(${activities.distance})`,
    totalDuration: sql<number>`sum(${activities.duration})`,
    totalCalories: sql<number>`sum(${activities.calories})`,
    totalElevation: sql<number>`sum(${activities.elevationGain})`,
  })
    .from(activities)
    .where(and(eq(activities.userId, userId), gte(activities.startTime, from.toISOString())))
    .groupBy(sql`date_trunc('week', ${activities.startTime})`, activities.activityType)
    .orderBy(sql`date_trunc('week', ${activities.startTime})`);

  return res.json(rows);
});

// PATCH /metrics/:date - manually update metrics for a date
router.patch('/:date', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { vo2max, ftp, weight, tdee } = req.body as Record<string, number>;
  const { date } = req.params;

  const existing = await db.select().from(metrics)
    .where(and(eq(metrics.userId, userId), eq(metrics.date, date)));

  const data = {
    userId,
    date,
    ...(vo2max !== undefined && { vo2max }),
    ...(ftp !== undefined && { ftp }),
    ...(weight !== undefined && { weight }),
    ...(tdee !== undefined && { tdee }),
    updatedAt: new Date().toISOString(),
  };

  if (existing.length > 0) {
    await db.update(metrics).set(data).where(and(eq(metrics.userId, userId), eq(metrics.date, date)));
  } else {
    await db.insert(metrics).values(data);
  }

  return res.json({ success: true });
});

export default router;
