import client from './client';

export type Discipline = 'run' | 'bike' | 'swim';
export type WorkoutStatus = 'planned' | 'completed' | 'skipped';

export interface WorkoutStep {
  name: string;
  durationMinutes?: number | null;
  distance?: number | null;
  distanceUnit?: 'km' | 'm' | null;
  targetType: string;
  targetValue: string;
  notes?: string | null;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  discipline: Discipline;
  name: string;
  description?: string | null;
  intensity?: string | null;
  duration?: number | null;
  distance?: number | null;
  workoutSteps?: WorkoutStep[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledWorkout {
  id: string;
  userId: string;
  discipline: Discipline;
  workoutType: string;
  title: string;
  description?: string | null;
  workoutSteps?: WorkoutStep[] | null;
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

export async function getWorkoutTemplates(discipline?: Discipline): Promise<WorkoutTemplate[]> {
  const res = await client.get('/scheduling/templates', { params: discipline ? { discipline } : undefined });
  return res.data;
}

export async function createWorkoutTemplate(payload: Omit<WorkoutTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<WorkoutTemplate> {
  const res = await client.post('/scheduling/templates', payload);
  return res.data;
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  await client.delete(`/scheduling/templates/${id}`);
}
