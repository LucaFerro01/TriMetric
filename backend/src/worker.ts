import 'dotenv/config';
import { createStravaWorker } from './workers/strava.worker';

const worker = createStravaWorker();
console.log('[Workers] Strava worker started');

process.on('SIGTERM', async () => {
  console.log('[Workers] SIGTERM received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Workers] SIGINT received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});
