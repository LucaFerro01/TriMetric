import { db } from '../db';
import { activities, metrics } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

/**
 * Estimate VO2max using Cooper's formula.
 * @param distanceMeters Distance in meters covered in 12 minutes
 */
export function estimateVO2MaxCooper(distanceMeters: number): number {
  return (distanceMeters - 504.9) / 44.73;
}

/**
 * Estimate VO2max from a recent run using the Daniels-Gilbert formula.
 * @param distanceMeters Distance in meters
 * @param timeSeconds Total time in seconds
 */
export function estimateVO2MaxRun(distanceMeters: number, timeSeconds: number): number {
  const timeMinutes = timeSeconds / 60;
  const velocity = distanceMeters / timeMinutes; // m/min
  const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMinutes) + 0.2989558 * Math.exp(-0.1932605 * timeMinutes);
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  return vo2 / percentMax;
}

/**
 * Estimate VO2max from a cycling effort using power-to-weight as a proxy.
 */
export function estimateVO2MaxBike(powerWatts: number, weightKg: number): number {
  if (powerWatts <= 0 || weightKg <= 0) return 0;
  const wattsPerKg = powerWatts / weightKg;
  return 10.8 * wattsPerKg + 7;
}

/**
 * Estimate FTP from power data (best 20-min power × 0.95).
 * @param powerData Array of power values in watts
 */
export function estimateFTP(powerData: number[]): number | null {
  if (powerData.length < 1200) return null;
  // Sort descending, take best 1200 data points (20 min at 1Hz)
  const sorted = [...powerData].sort((a, b) => b - a);
  const best1200 = sorted.slice(0, 1200);
  const avg = best1200.reduce((a, b) => a + b, 0) / best1200.length;
  return Math.round(avg * 0.95);
}

/**
 * Calculate calories burned using MET values.
 * @param activityType Type of activity
 * @param durationSeconds Duration in seconds
 * @param weightKg Body weight in kg
 */
export function calculateCaloriesMET(activityType: string, durationSeconds: number, weightKg: number): number {
  const metValues: Record<string, number> = {
    run: 9.8, ride: 7.5, swim: 8.0, walk: 3.5, hike: 6.0,
    strength: 5.0, yoga: 3.0, workout: 5.0,
  };
  const met = metValues[activityType] || 5.0;
  const durationHours = durationSeconds / 3600;
  return Math.round(met * weightKg * durationHours);
}

export function estimateCaloriesBurned(activityType: string, durationSeconds: number, weightKg?: number | null): number {
  return calculateCaloriesMET(activityType, durationSeconds, weightKg ?? 70);
}

/**
 * Calculate TDEE (Total Daily Energy Expenditure) using Mifflin-St Jeor equation.
 */
export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  isMale: boolean,
  activityMultiplier = 1.55
): number {
  const bmr = isMale
    ? 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  return Math.round(bmr * activityMultiplier);
}

/**
 * Calculate average speed/pace from distance and duration.
 */
export function calculatePace(distanceMeters: number, durationSeconds: number) {
  const speedMps = distanceMeters / durationSeconds;
  const speedKph = speedMps * 3.6;
  const paceMinPerKm = 1000 / (speedMps * 60);
  return { speedMps, speedKph, paceMinPerKm };
}

/**
 * Aggregate daily metrics for a user and upsert into metrics table.
 */
export async function aggregateDailyMetrics(userId: string, date: Date): Promise<void> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dayActivities = await db.select()
    .from(activities)
    .where(and(
      eq(activities.userId, userId),
      gte(activities.startTime, startOfDay.toISOString()),
      lte(activities.startTime, endOfDay.toISOString()),
    ));

  const totalDistance = dayActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalDuration = dayActivities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const totalCalories = dayActivities.reduce((sum, a) => sum + (a.calories || 0), 0);

  const dateStr = date.toISOString().split('T')[0];

  const existing = await db.select().from(metrics)
    .where(and(eq(metrics.userId, userId), eq(metrics.date, dateStr)));

  const data = {
    userId,
    date: dateStr,
    totalDistance,
    totalDuration,
    totalCalories,
    updatedAt: new Date().toISOString(),
  };

  if (existing.length > 0) {
    await db.update(metrics).set(data).where(and(eq(metrics.userId, userId), eq(metrics.date, dateStr)));
  } else {
    await db.insert(metrics).values(data);
  }
}
