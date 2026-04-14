import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID || '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET || '',
    webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'trimetric-verify',
    // Use backend callback by default so OAuth works behind Docker/tunnels (ngrok/public domain).
    redirectUri: process.env.STRAVA_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3001'}/auth/strava/callback`,
  },
  zepp: {
    appToken: process.env.ZEPP_APP_TOKEN || '',
  },
} as const;
