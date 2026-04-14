DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduled_workouts'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'date'
    ) THEN
      UPDATE "scheduled_workouts"
      SET "scheduled_date" = COALESCE("scheduled_date", "date")
      WHERE "scheduled_date" IS NULL;
      ALTER TABLE "scheduled_workouts" DROP COLUMN "date";
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'duration_minutes'
    ) THEN
      UPDATE "scheduled_workouts"
      SET "duration" = COALESCE("duration", "duration_minutes")
      WHERE "duration" IS NULL;
      ALTER TABLE "scheduled_workouts" DROP COLUMN "duration_minutes";
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'notes'
    ) THEN
      UPDATE "scheduled_workouts"
      SET "description" = COALESCE("description", "notes")
      WHERE "description" IS NULL;
      ALTER TABLE "scheduled_workouts" DROP COLUMN "notes";
    END IF;
  END IF;
END $$;
