CREATE TABLE IF NOT EXISTS "workout_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "discipline" varchar(50) NOT NULL,
  "name" varchar(120) NOT NULL,
  "description" text,
  "intensity" varchar(50),
  "duration" integer,
  "distance" real,
  "workout_steps" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "workout_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "workout_templates_user_discipline_idx" ON "workout_templates" USING btree ("user_id","discipline");
CREATE INDEX IF NOT EXISTS "workout_templates_user_created_idx" ON "workout_templates" USING btree ("user_id","created_at");