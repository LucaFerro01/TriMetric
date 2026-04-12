import client from './client';

export interface Activity {
  id: string;
  userId: string;
  externalId?: string;
  source: string;
  activityType: string;
  name?: string;
  startTime: string;
  duration?: number;
  distance?: number;
  elevationGain?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgPower?: number;
  maxPower?: number;
  avgSpeed?: number;
  calories?: number;
  createdAt: string;
}

export interface ActivitySummary {
  activityType: string;
  count: number;
  totalDistance: number;
  totalDuration: number;
  totalCalories: number;
  avgHeartRate: number;
}

export async function getActivities(params?: {
  from?: string; to?: string; type?: string; limit?: number; offset?: number;
}): Promise<Activity[]> {
  const res = await client.get('/activities', { params });
  return res.data;
}

export async function getActivity(id: string): Promise<Activity & { streams?: Record<string, unknown> }> {
  const res = await client.get(`/activities/${id}`);
  return res.data;
}

export async function getSummary(period?: string): Promise<ActivitySummary[]> {
  const res = await client.get('/activities/summary', { params: { period } });
  return res.data;
}

export async function deleteActivity(id: string): Promise<void> {
  await client.delete(`/activities/${id}`);
}

export async function syncFromStrava(): Promise<{ synced: number }> {
  const res = await client.post('/activities/strava/sync');
  return res.data;
}

export async function uploadFile(file: File): Promise<Activity> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post('/activities/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
