import { Worker, Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { fetchActivity, saveStravaActivity } from '../services/strava.service';
import { aggregateDailyMetrics } from '../services/metrics.service';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

let stravaQueue: Queue | null = null;

function getStravaQueue(): Queue {
  if (!stravaQueue) {
    stravaQueue = new Queue('strava', {
      connection: new IORedis(config.redisUrl, { maxRetriesPerRequest: null }),
    });
  }
  return stravaQueue;
}

export async function enqueueStravaActivity(activityId: number, stravaUserId: number): Promise<boolean> {
  try {
    await getStravaQueue().add('fetch-strava-activity', {
      activityId,
      stravaUserId,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    return true;
  } catch (err) {
    console.warn('[StravaQueue] Failed to enqueue activity:', err);
    return false;
  }
}

export function createStravaWorker() {
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker(
    'strava',
    async (job: Job) => {
      const { activityId, stravaUserId } = job.data as { activityId: number; stravaUserId: string };

      // Find our user by Strava ID
      const [user] = await db.select().from(users).where(eq(users.stravaId, String(stravaUserId)));
      if (!user) {
        console.warn(`[StravaWorker] No user found for Strava ID: ${stravaUserId}`);
        return;
      }

      const stravaActivity = await fetchActivity(user.id, activityId);
      const saved = await saveStravaActivity(user.id, stravaActivity);

      // Aggregate daily metrics
      await aggregateDailyMetrics(user.id, new Date(saved.startTime));

      console.log(`[StravaWorker] Saved activity ${saved.id} for user ${user.id}`);
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error(`[StravaWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
