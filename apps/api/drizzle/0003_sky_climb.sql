CREATE TABLE "climb_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"mode" text NOT NULL,
	"seed" text NOT NULL,
	"puzzle_date" date,
	"best_floor" integer DEFAULT 0 NOT NULL,
	"time_ms" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"falls" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'climbing' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "climb_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "climb_runs_puzzle_date_mode_index" ON "climb_runs" USING btree ("puzzle_date","mode");--> statement-breakpoint
CREATE INDEX "climb_runs_user_id_index" ON "climb_runs" USING btree ("user_id");