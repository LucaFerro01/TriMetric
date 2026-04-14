import { Router, Request, Response } from 'express';
import { db } from '../db';
import { scheduledWorkouts } from '../db/schema';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';

const router: Router = Router();

const workoutSchema = z.object({
  discipline: z.enum(['run', 'bike', 'swim']),
  workoutType: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  duration: z.number().int().min(1).max(480).optional().nullable(),
  distance: z.number().min(0).max(300).optional().nullable(),
  intensity: z.string().max(50).optional().nullable(),
  status: z.enum(['planned', 'completed', 'skipped']).optional(),
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

router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { from, to } = req.query as { from?: string; to?: string };
  const conditions = [eq(scheduledWorkouts.userId, userId)];

  if (from) conditions.push(gte(scheduledWorkouts.scheduledDate, from));
  if (to) conditions.push(lte(scheduledWorkouts.scheduledDate, to));

  const rows = await db.select().from(scheduledWorkouts)
    .where(and(...conditions))
    .orderBy(
      asc(scheduledWorkouts.scheduledDate),
      sql`${scheduledWorkouts.scheduledTime} NULLS LAST`,
      asc(scheduledWorkouts.createdAt)
    );

  return res.json(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const parsed = workoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() });
  }

  const [inserted] = await db.insert(scheduledWorkouts).values({
    userId,
    ...parsed.data,
    status: parsed.data.status ?? 'planned',
    updatedAt: new Date().toISOString(),
  }).returning();

  return res.status(201).json(inserted);
});

router.patch('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const partialSchema = workoutSchema.partial();
  const parsed = partialSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.flatten() });
  }

  const [updated] = await db.update(scheduledWorkouts)
    .set({
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(scheduledWorkouts.id, req.params.id), eq(scheduledWorkouts.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: 'Not found' });
  return res.json(updated);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const deleted = await db.delete(scheduledWorkouts)
    .where(and(eq(scheduledWorkouts.id, req.params.id), eq(scheduledWorkouts.userId, userId)))
    .returning({ id: scheduledWorkouts.id });

  if (deleted.length === 0) return res.status(404).json({ error: 'Not found' });
  return res.json({ success: true });
});

export default router;
