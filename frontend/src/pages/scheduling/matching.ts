import type { Activity } from '../../api/activities';
import type { Discipline, ScheduledWorkout } from '../../api/scheduling';

const SECONDS_PER_MINUTE = 60;
const METERS_PER_KM = 1000;
const STRICT_TOLERANCE = 0.3;
const RELAXED_TOLERANCE = 0.45;

const activityTypesByDiscipline: Record<Discipline, string[]> = {
  run: ['run', 'running', 'virtualrun', 'trailrun'],
  bike: ['ride', 'bike', 'cycling', 'virtualride', 'ebikeride'],
  swim: ['swim', 'swimming'],
};

function normalizeActivityType(activityType: string): string {
  return activityType.toLowerCase().replace(/[\s_-]+/g, '');
}

function isMatchingDiscipline(discipline: Discipline, activityType: string): boolean {
  const normalized = normalizeActivityType(activityType);
  return activityTypesByDiscipline[discipline].includes(normalized);
}

function relativeDifference(actual: number, expected: number): number {
  if (actual <= 0 || expected <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(actual - expected) / expected;
}

function isWithinTolerance(actual: number | null | undefined, expected: number | null | undefined, tolerance: number): boolean {
  if (actual == null || expected == null || expected <= 0) return false;
  return relativeDifference(actual, expected) <= tolerance;
}

export function findMatchingActivity(workout: ScheduledWorkout, activities: Activity[]): Activity | null {
  const workoutDurationMinutes = workout.duration;
  const workoutDistanceKm = workout.distance;
  const hasDuration = workoutDurationMinutes != null && workoutDurationMinutes > 0;
  const hasDistance = workoutDistanceKm != null && workoutDistanceKm > 0;
  if (!hasDuration && !hasDistance) return null;

  const expectedDuration = hasDuration ? workoutDurationMinutes * SECONDS_PER_MINUTE : null;
  const expectedDistance = hasDistance ? workoutDistanceKm * METERS_PER_KM : null;

  const candidates = activities.filter((activity) => isMatchingDiscipline(workout.discipline, activity.activityType));

  let best: { activity: Activity; score: number } | null = null;

  for (const activity of candidates) {
    const durationStrict = isWithinTolerance(activity.duration, expectedDuration, STRICT_TOLERANCE);
    const distanceStrict = isWithinTolerance(activity.distance, expectedDistance, STRICT_TOLERANCE);
    const durationRelaxed = isWithinTolerance(activity.duration, expectedDuration, RELAXED_TOLERANCE);
    const distanceRelaxed = isWithinTolerance(activity.distance, expectedDistance, RELAXED_TOLERANCE);

    let matches = false;
    if (hasDuration && hasDistance) {
      matches = (durationStrict && distanceRelaxed) || (distanceStrict && durationRelaxed);
    } else if (hasDuration) {
      matches = durationStrict;
    } else {
      matches = distanceStrict;
    }

    if (!matches) continue;

    const durationScore = hasDuration && activity.duration != null
      ? relativeDifference(activity.duration, expectedDuration!)
      : 1;
    const distanceScore = hasDistance && activity.distance != null
      ? relativeDifference(activity.distance, expectedDistance!)
      : 1;
    const score = durationScore + distanceScore;

    if (!best || score < best.score) {
      best = { activity, score };
    }
  }

  return best?.activity ?? null;
}
