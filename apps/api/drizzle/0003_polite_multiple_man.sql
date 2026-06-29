CREATE TABLE IF NOT EXISTS "adaptation_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"macro_plan_id" uuid NOT NULL,
	"for_week_start" date NOT NULL,
	"data" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "adaptation_suggestions" ADD CONSTRAINT "adaptation_suggestions_macro_plan_id_macro_plans_id_fk" FOREIGN KEY ("macro_plan_id") REFERENCES "public"."macro_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adaptation_suggestions_macro_week_idx" ON "adaptation_suggestions" USING btree ("macro_plan_id","for_week_start");