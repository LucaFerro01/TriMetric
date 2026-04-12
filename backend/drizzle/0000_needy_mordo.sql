CREATE TABLE IF NOT EXISTS "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"external_id" varchar(255),
	"source" varchar(50) NOT NULL,
	"activity_type" varchar(100) NOT NULL,
	"name" varchar(500),
	"start_time" timestamp NOT NULL,
	"duration" integer,
	"distance" real,
	"elevation_gain" real,
	"avg_heart_rate" integer,
	"max_heart_rate" integer,
	"avg_power" integer,
	"max_power" integer,
	"avg_speed" real,
	"max_speed" real,
	"calories" integer,
	"avg_cadence" integer,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"vo2max" real,
	"ftp" integer,
	"total_calories" integer,
	"total_distance" real,
	"total_duration" integer,
	"tdee" integer,
	"weight" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stream_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"time" jsonb,
	"heartrate" jsonb,
	"power" jsonb,
	"cadence" jsonb,
	"velocity" jsonb,
	"altitude" jsonb,
	"latlng" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"name" varchar(255),
	"weight" real,
	"height" real,
	"birth_date" date,
	"strava_id" varchar(100),
	"strava_access_token" text,
	"strava_refresh_token" text,
	"strava_token_expires_at" integer,
	"zepp_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_strava_id_unique" UNIQUE("strava_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_user_id_idx" ON "activities" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_start_time_idx" ON "activities" ("start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_source_idx" ON "activities" ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_external_id_idx" ON "activities" ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "metrics_user_date_idx" ON "metrics" ("user_id","date");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "metrics" ADD CONSTRAINT "metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stream_data" ADD CONSTRAINT "stream_data_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
