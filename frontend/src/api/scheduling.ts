import client from './client';

export type Discipline = 'run' | 'bike' | 'swim';
export type WorkoutStatus = 'planned' | 'completed' | 'skipped';

export interface ScheduledWorkout {
  id: string;
  userId: string;
  discipline: Discipline;
  workoutType: string;
  title: string;
  description?: string | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  duration?: number | null;
  distance?: number | null;
  intensity?: string | null;
  status: WorkoutStatus;
  createdAt: string;
  updatedAt: string;
}

export type CreateScheduledWorkout = Omit<ScheduledWorkout, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export async function getScheduledWorkouts(params?: { from?: string; to?: string }): Promise<ScheduledWorkout[]> {
  const res = await client.get('/scheduling', { params });
  return res.data;
}

export async function createScheduledWorkout(payload: CreateScheduledWorkout): Promise<ScheduledWorkout> {
  const res = await client.post('/scheduling', payload);
  return res.data;
}

export async function updateScheduledWorkout(id: string, payload: Partial<CreateScheduledWorkout>): Promise<ScheduledWorkout> {
  const res = await client.patch(`/scheduling/${id}`, payload);
  return res.data;
}

export async function deleteScheduledWorkout(id: string): Promise<void> {
  await client.delete(`/scheduling/${id}`);
}
