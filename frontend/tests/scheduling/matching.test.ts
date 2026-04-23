import { describe, expect, it } from 'vitest';
import type { Activity } from '../../src/api/activities';
import type { ScheduledWorkout } from '../../src/api/scheduling';
import { findMatchingActivity } from '../../src/pages/scheduling/matching';

function buildWorkout(overrides: Partial<ScheduledWorkout>): ScheduledWorkout {
  return {
    id: 'w-1',
    userId: 'u-1',
    discipline: 'run',
    workoutType: 'Tempo',
    title: 'Tempo run',
    scheduledDate: '2026-01-01',
    scheduledTime: '07:00',
    duration: 60,
    distance: 10,
    intensity: null,
    description: null,
    workoutSteps: null,
    status: 'planned',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildActivity(overrides: Partial<Activity>): Activity {
  return {
    id: 'a-1',
    userId: 'u-1',
    source: 'strava',
    activityType: 'run',
    startTime: '2026-01-01T06:00:00.000Z',
    duration: 3600,
    distance: 10000,
    createdAt: '2026-01-01T06:00:00.000Z',
    ...overrides,
  };
}

describe('findMatchingActivity', () => {
  it('matches workouts even when one metric is slightly off but still realistic', () => {
    const workout = buildWorkout({ discipline: 'run', duration: 60, distance: 10 });
    const activity = buildActivity({ duration: 3000, distance: 10500 });

    const match = findMatchingActivity(workout, [activity]);
    expect(match?.id).toBe(activity.id);
  });

  it('supports bike aliases from imported files/devices', () => {
    const workout = buildWorkout({ discipline: 'bike', duration: 90, distance: 40 });
    const activity = buildActivity({ activityType: 'cycling', duration: 5400, distance: 39500 });

    const match = findMatchingActivity(workout, [activity]);
    expect(match?.id).toBe(activity.id);
  });

  it('does not match activities of a different discipline', () => {
    const workout = buildWorkout({ discipline: 'swim', duration: 45, distance: 2 });
    const runActivity = buildActivity({ activityType: 'run', duration: 2700, distance: 2000 });

    const match = findMatchingActivity(workout, [runActivity]);
    expect(match).toBeNull();
  });

  it('does not match when both duration and distance are too far from target', () => {
    const workout = buildWorkout({ discipline: 'run', duration: 60, distance: 10 });
    const activity = buildActivity({ duration: 1800, distance: 4000 });

    const match = findMatchingActivity(workout, [activity]);
    expect(match).toBeNull();
  });
});
