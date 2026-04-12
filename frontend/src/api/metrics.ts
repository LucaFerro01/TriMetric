import client from './client';

export interface MetricRecord {
  id: string;
  date: string;
  vo2max?: number;
  ftp?: number;
  totalCalories?: number;
  totalDistance?: number;
  totalDuration?: number;
  tdee?: number;
  weight?: number;
}

export interface WeeklyMetric {
  week: string;
  activityType: string;
  count: number;
  totalDistance: number;
  totalDuration: number;
  totalCalories: number;
  totalElevation: number;
}

export interface Vo2MaxPoint {
  date: string;
  vo2max: number;
  activityId: string;
}

export interface Vo2MaxHistoryResponse {
  run: Vo2MaxPoint[];
  bike: Vo2MaxPoint[];
}

export interface TodayEnergy {
  date: string;
  baseCalories: number | null;
  activityCalories: number;
  totalCalories: number;
  activitiesCount: number;
  weight?: number;
  message?: string;
}

export async function getMetrics(days?: number): Promise<MetricRecord[]> {
  const res = await client.get('/metrics', { params: { days } });
  return res.data;
}

export async function getVO2MaxHistory(): Promise<Vo2MaxHistoryResponse> {
  const res = await client.get('/metrics/vo2max');
  return res.data;
}

export async function getTodayEnergy(): Promise<TodayEnergy> {
  const res = await client.get('/metrics/today-energy');
  return res.data;
}

export async function getFTP(): Promise<{ ftp: number | null; basedOnRides?: number; message?: string }> {
  const res = await client.get('/metrics/ftp');
  return res.data;
}

export async function getTDEE(): Promise<{ tdee: number | null; weight?: number; height?: number; age?: number; message?: string }> {
  const res = await client.get('/metrics/tdee');
  return res.data;
}

export async function getWeeklyMetrics(weeks?: number): Promise<WeeklyMetric[]> {
  const res = await client.get('/metrics/weekly', { params: { weeks } });
  return res.data;
}

export async function updateMetrics(date: string, data: Partial<MetricRecord>): Promise<void> {
  await client.patch(`/metrics/${date}`, data);
}
