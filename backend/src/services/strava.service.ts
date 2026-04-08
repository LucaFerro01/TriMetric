import axios from 'axios';
import { db } from '../db';
import { users, activities } from '../db/schema';
import { eq } from 'drizzle-orm';
import { config } from '../config';

const STRAVA_BASE = 'https://www.strava.com/api/v3';
const STRAVA_AUTH = 'https://www.strava.com/oauth';

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
  };
}

export async function exchangeCode(code: string): Promise<StravaTokens> {
  const response = await axios.post<StravaTokens>(`${STRAVA_AUTH}/token`, {
    client_id: config.strava.clientId,
    client_secret: config.strava.clientSecret,
    code,
    grant_type: 'authorization_code',
  });
  return response.data;
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
  const response = await axios.post<StravaTokens>(`${STRAVA_AUTH}/token`, {
    client_id: config.strava.clientId,
    client_secret: config.strava.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return response.data;
}

export async function getValidToken(userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.stravaAccessToken || !user.stravaRefreshToken) {
    throw new Error('User has no Strava tokens');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (user.stravaTokenExpiresAt && user.stravaTokenExpiresAt > nowSeconds + 300) {
    return user.stravaAccessToken;
  }

  // Refresh
  const tokens = await refreshAccessToken(user.stravaRefreshToken);
  await db.update(users)
    .set({
      stravaAccessToken: tokens.access_token,
      stravaRefreshToken: tokens.refresh_token,
      stravaTokenExpiresAt: tokens.expires_at,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId));

  return tokens.access_token;
}

export async function fetchActivity(userId: string, stravaActivityId: number) {
  const token = await getValidToken(userId);
  const response = await axios.get(`${STRAVA_BASE}/activities/${stravaActivityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function fetchActivityStreams(userId: string, stravaActivityId: number) {
  const token = await getValidToken(userId);
  const keys = 'time,heartrate,watts,cadence,velocity_smooth,altitude,latlng';
  const response = await axios.get(
    `${STRAVA_BASE}/activities/${stravaActivityId}/streams?keys=${keys}&key_by_type=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

function mapActivityType(stravaType: string): string {
  const map: Record<string, string> = {
    Run: 'run', Ride: 'ride', Swim: 'swim', Walk: 'walk',
    Hike: 'hike', VirtualRide: 'ride', VirtualRun: 'run',
    WeightTraining: 'strength', Yoga: 'yoga', Workout: 'workout',
  };
  return map[stravaType] || stravaType.toLowerCase();
}

export async function saveStravaActivity(userId: string, stravaActivity: Record<string, unknown>) {
  const existing = await db.select()
    .from(activities)
    .where(eq(activities.externalId, String(stravaActivity.id)));

  const data = {
    userId,
    externalId: String(stravaActivity.id),
    source: 'strava' as const,
    activityType: mapActivityType(stravaActivity.type as string),
    name: stravaActivity.name as string,
    startTime: new Date(stravaActivity.start_date as string).toISOString(),
    duration: stravaActivity.moving_time as number,
    distance: stravaActivity.distance as number,
    elevationGain: stravaActivity.total_elevation_gain as number,
    avgHeartRate: stravaActivity.average_heartrate as number | null,
    maxHeartRate: stravaActivity.max_heartrate as number | null,
    avgPower: stravaActivity.average_watts as number | null,
    maxPower: stravaActivity.max_watts as number | null,
    avgSpeed: stravaActivity.average_speed as number,
    maxSpeed: stravaActivity.max_speed as number,
    calories: stravaActivity.calories as number | null,
    avgCadence: stravaActivity.average_cadence as number | null,
    rawData: stravaActivity,
  };

  if (existing.length > 0) {
    await db.update(activities).set(data).where(eq(activities.externalId, String(stravaActivity.id)));
    return existing[0];
  }

  const [created] = await db.insert(activities).values(data).returning();
  return created;
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: config.strava.clientId,
    redirect_uri: config.strava.redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  });
  return `${STRAVA_AUTH}/authorize?${params}`;
}
