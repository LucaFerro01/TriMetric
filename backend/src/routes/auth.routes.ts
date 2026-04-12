import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getAuthUrl, exchangeCode } from '../services/strava.service';
import { syncStravaActivities } from '../services/strava.service';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const router = Router();

// GET /auth/strava - redirect to Strava
router.get('/strava', (_req: Request, res: Response) => {
  res.redirect(getAuthUrl());
});

// GET /auth/strava/callback
router.get('/strava/callback', authLimiter, async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error || !code) {
    return res.redirect(`${config.frontendUrl}/auth/error?message=${error || 'no_code'}`);
  }

  try {
    const tokens = await exchangeCode(code);
    const athlete = tokens.athlete;

    // Upsert user
    const existing = await db.select().from(users).where(eq(users.stravaId, String(athlete.id)));

    let userId: string;
    const isNewUser = existing.length === 0;
    if (existing.length > 0) {
      await db.update(users).set({
        stravaAccessToken: tokens.access_token,
        stravaRefreshToken: tokens.refresh_token,
        stravaTokenExpiresAt: tokens.expires_at,
        name: `${athlete.firstname} ${athlete.lastname}`,
        updatedAt: new Date().toISOString(),
      }).where(eq(users.stravaId, String(athlete.id)));
      userId = existing[0].id;
    } else {
      const [created] = await db.insert(users).values({
        email: `strava_${athlete.id}@trimetric.local`,
        name: `${athlete.firstname} ${athlete.lastname}`,
        stravaId: String(athlete.id),
        stravaAccessToken: tokens.access_token,
        stravaRefreshToken: tokens.refresh_token,
        stravaTokenExpiresAt: tokens.expires_at,
      }).returning();
      userId = created.id;
    }

    const jwtToken = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });

    // On first login, kick off a background historical sync so activities appear immediately
    if (isNewUser) {
      syncStravaActivities(userId).then((count) => {
        console.log(`[Auth] Initial Strava sync: ${count} activities imported for user ${userId}`);
      }).catch((err) => {
        console.error(`[Auth] Initial Strava sync failed for user ${userId}:`, err);
      });
    }

    return res.redirect(`${config.frontendUrl}/auth/callback?token=${jwtToken}`);
  } catch (err) {
    console.error('[Auth] Strava callback error:', err);
    return res.redirect(`${config.frontendUrl}/auth/error?message=auth_failed`);
  }
});

// GET /auth/me - get current user
router.get('/me', authLimiter, async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      weight: users.weight,
      height: users.height,
      birthDate: users.birthDate,
      stravaId: users.stravaId,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, payload.userId));

    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// PATCH /auth/profile - update user profile
router.patch('/profile', authLimiter, async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
    const { weight, height, birthDate, name } = req.body as Record<string, unknown>;

    await db.update(users).set({
      ...(weight !== undefined && { weight: Number(weight) }),
      ...(height !== undefined && { height: Number(height) }),
      ...(birthDate !== undefined && { birthDate: String(birthDate) }),
      ...(name !== undefined && { name: String(name) }),
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, payload.userId));

    return res.json({ success: true });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
