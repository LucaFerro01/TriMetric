import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import webhookRoutes from './routes/webhook.routes';
import activitiesRoutes from './routes/activities.routes';
import metricsRoutes from './routes/metrics.routes';
import schedulingRoutes from './routes/scheduling.routes';

const app = express();

// Security & middleware
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(compression());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/webhook', webhookRoutes);
app.use('/activities', activitiesRoutes);
app.use('/metrics', metricsRoutes);
app.use('/scheduling', schedulingRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
const server = app.listen(config.port, () => {
  console.log(`[Server] Listening on http://localhost:${config.port}`);
});

export default server;
