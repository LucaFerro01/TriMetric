CREATE TABLE IF NOT EXISTS "scheduled_workouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "discipline" varchar(50) NOT NULL,
  "workout_type" varchar(100) NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "scheduled_date" date NOT NULL,
  "scheduled_time" varchar(5),
  "duration" integer,
  "distance" real,
  "intensity" varchar(50),
  "status" varchar(30) DEFAULT 'planned' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "scheduled_workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "scheduled_workouts_user_date_idx" ON "scheduled_workouts" USING btree ("user_id","scheduled_date");
CREATE INDEX IF NOT EXISTS "scheduled_workouts_discipline_idx" ON "scheduled_workouts" USING btree ("discipline");
