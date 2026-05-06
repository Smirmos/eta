CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."profile_source" AS ENUM('strava_inferred', 'questionnaire', 'mixed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "athlete_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"source" "profile_source" NOT NULL,
	"overall_confidence" "confidence_level" NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "athlete_profiles_user_id_idx" ON "athlete_profiles" USING btree ("user_id");