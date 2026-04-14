DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduled_workouts'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'title'
    ) THEN
      ALTER TABLE "scheduled_workouts" ADD COLUMN "title" varchar(255);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'description'
    ) THEN
      ALTER TABLE "scheduled_workouts" ADD COLUMN "description" text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'scheduled_date'
    ) THEN
      ALTER TABLE "scheduled_workouts" ADD COLUMN "scheduled_date" date;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'scheduled_time'
    ) THEN
      ALTER TABLE "scheduled_workouts" ADD COLUMN "scheduled_time" varchar(5);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'duration'
    ) THEN
      ALTER TABLE "scheduled_workouts" ADD COLUMN "duration" integer;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'distance'
    ) THEN
      ALTER TABLE "scheduled_workouts" ADD COLUMN "distance" real;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'intensity'
    ) THEN
      ALTER TABLE "scheduled_workouts" ADD COLUMN "intensity" varchar(50);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'status'
    ) THEN
      ALTER TABLE "scheduled_workouts" ADD COLUMN "status" varchar(30) DEFAULT 'planned' NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'date'
    ) THEN
      UPDATE "scheduled_workouts"
      SET "scheduled_date" = COALESCE("scheduled_date", "date")
      WHERE "scheduled_date" IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'notes'
    ) THEN
      UPDATE "scheduled_workouts"
      SET "description" = COALESCE("description", "notes")
      WHERE "description" IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'scheduled_workouts' AND column_name = 'duration_minutes'
    ) THEN
      UPDATE "scheduled_workouts"
      SET "duration" = COALESCE("duration", "duration_minutes")
      WHERE "duration" IS NULL;
    END IF;

    UPDATE "scheduled_workouts"
    SET "scheduled_date" = COALESCE("scheduled_date", CURRENT_DATE),
        "title" = COALESCE("title", INITCAP(COALESCE("discipline", 'Workout')) || ' ' || COALESCE("workout_type", 'Session'));

    ALTER TABLE "scheduled_workouts" ALTER COLUMN "scheduled_date" SET NOT NULL;
    ALTER TABLE "scheduled_workouts" ALTER COLUMN "title" SET NOT NULL;

    CREATE INDEX IF NOT EXISTS "scheduled_workouts_user_date_idx" ON "scheduled_workouts" ("user_id", "scheduled_date");
    CREATE INDEX IF NOT EXISTS "scheduled_workouts_discipline_idx" ON "scheduled_workouts" ("discipline");
  END IF;
END $$;
