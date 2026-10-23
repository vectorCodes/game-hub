CREATE TABLE "bumper_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"run_date" date NOT NULL,
	"map" text NOT NULL,
	"modifier" text NOT NULL,
	"waves" integer DEFAULT 0 NOT NULL,
	"kos" integer DEFAULT 0 NOT NULL,
	"peak_wobble" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"time_ms" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'playing' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bumper_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "bumper_runs_run_date_index" ON "bumper_runs" USING btree ("run_date");--> statement-breakpoint
CREATE INDEX "bumper_runs_user_id_index" ON "bumper_runs" USING btree ("user_id");