CREATE TABLE IF NOT EXISTS "oauth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scopes" text NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workouts_completed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"date" date NOT NULL,
	"discipline" text NOT NULL,
	"workout_code" text,
	"actual_tss" numeric,
	"tss_status" text NOT NULL,
	"planned_tss" numeric,
	"planned_duration_seconds" integer,
	"actual_duration_seconds" integer,
	"perceived_exertion" integer,
	"notes" text,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_credentials_user_provider_unique" ON "oauth_credentials" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_credentials_provider_external_idx" ON "oauth_credentials" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workouts_completed_source_external_unique" ON "workouts_completed" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workouts_completed_user_date_idx" ON "workouts_completed" USING btree ("user_id","date");