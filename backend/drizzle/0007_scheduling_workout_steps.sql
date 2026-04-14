ALTER TABLE "scheduled_workouts"
ADD COLUMN IF NOT EXISTS "workout_steps" jsonb;