CREATE TABLE IF NOT EXISTS "macro_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"athlete_profile_id" uuid NOT NULL,
	"race_date" date NOT NULL,
	"data" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"macro_plan_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"week_start_date" date NOT NULL,
	"data" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "macro_plans" ADD CONSTRAINT "macro_plans_athlete_profile_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_profile_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weekly_details" ADD CONSTRAINT "weekly_details_macro_plan_id_macro_plans_id_fk" FOREIGN KEY ("macro_plan_id") REFERENCES "public"."macro_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "macro_plans_user_id_idx" ON "macro_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "macro_plans_athlete_profile_idx" ON "macro_plans" USING btree ("athlete_profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_details_macro_plan_week_idx" ON "weekly_details" USING btree ("macro_plan_id","week_number");