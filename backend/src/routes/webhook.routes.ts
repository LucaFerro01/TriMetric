import { Router, Request, Response } from 'express';
import { config } from '../config';
import { enqueueStravaActivity } from '../workers/strava.worker';

const router: Router = Router();

// GET /webhook/strava - Strava webhook verification
router.get('/strava', (req: Request, res: Response) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query as Record<string, string>;

  if (mode === 'subscribe' && token === config.strava.webhookVerifyToken) {
    console.log('[Webhook] Strava subscription verified');
    return res.json({ 'hub.challenge': challenge });
  }
  return res.sendStatus(403);
});

// POST /webhook/strava - Strava activity events
router.post('/strava', async (req: Request, res: Response) => {
  const { object_type, aspect_type, object_id, owner_id } = req.body as {
    object_type: string;
    aspect_type: string;
    object_id: number;
    owner_id: number;
  };

  // Acknowledge immediately (Strava requires < 2s response)
  res.sendStatus(200);

  if (object_type === 'activity' && (aspect_type === 'create' || aspect_type === 'update')) {
    const queued = await enqueueStravaActivity(object_id, owner_id);
    if (queued) {
      console.log(`[Webhook] Queued activity ${object_id} for user ${owner_id}`);
    } else {
      console.warn(`[Webhook] Could not queue activity ${object_id} (Redis unavailable)`);
    }
  }
});

// POST /webhook/strava/subscribe - Register webhook with Strava
router.post('/strava/subscribe', async (_req: Request, res: Response) => {
  const axios = await import('axios');
  try {
    const body = new URLSearchParams({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      callback_url: `${config.backendUrl}/webhook/strava`,
      verify_token: config.strava.webhookVerifyToken,
    });

    const response = await axios.default.post('https://www.strava.com/api/v3/push_subscriptions', body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    res.json(response.data);
  } catch (err) {
    const error = err as { response?: { data: unknown }; message?: string };
    res.status(400).json({ error: 'Failed to subscribe', details: error.response?.data });
  }
});

export default router;
