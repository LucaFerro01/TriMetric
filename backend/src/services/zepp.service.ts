import axios, { AxiosError } from 'axios';

const MIFIT_BASE = 'https://api-mifit.huami.com';

export interface ZeppActivity {
  id: string;
  start_time: number;
  end_time: number;
  type: number;
  calories: number;
  distance: number;
  avg_pace?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  step_count?: number;
}

export async function fetchZeppActivities(appToken: string, startDate: Date, endDate: Date): Promise<ZeppActivity[]> {
  try {
    const response = await axios.get(`${MIFIT_BASE}/v1/sport/run/history.json`, {
      headers: {
        'apptoken': appToken,
        'appPlatform': 'web',
        'appname': 'com.xiaomi.hm.health',
        'Content-Type': 'application/json',
      },
      params: {
        query_type: 'detail',
        source: '1',
        from_date: Math.floor(startDate.getTime() / 1000),
        to_date: Math.floor(endDate.getTime() / 1000),
      },
      timeout: 10000,
    });

    return response.data?.data?.summary || [];
  } catch (error) {
    const err = error as AxiosError;
    console.error('[Zepp] Failed to fetch activities:', err.message);
    // Unofficial API - don't throw, return empty array
    return [];
  }
}

function mapZeppType(typeCode: number): string {
  const map: Record<number, string> = {
    1: 'run', 6: 'ride', 9: 'walk', 10: 'hike',
    17: 'swim', 39: 'strength', 48: 'yoga',
  };
  return map[typeCode] || 'workout';
}

export function normalizeZeppActivity(activity: ZeppActivity) {
  return {
    source: 'zepp' as const,
    externalId: activity.id,
    activityType: mapZeppType(activity.type),
    startTime: new Date(activity.start_time * 1000).toISOString(),
    duration: activity.end_time - activity.start_time,
    distance: activity.distance || null,
    calories: activity.calories || null,
    avgHeartRate: activity.avg_heart_rate || null,
    maxHeartRate: activity.max_heart_rate || null,
    rawData: activity,
  };
}
