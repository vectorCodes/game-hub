CREATE TABLE "putt_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"mode" text NOT NULL,
	"seed" text NOT NULL,
	"puzzle_date" date,
	"strokes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"to_par" integer DEFAULT 0 NOT NULL,
	"aces" integer DEFAULT 0 NOT NULL,
	"time_ms" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'playing' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_hole_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "putt_rounds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "putt_rounds_puzzle_date_mode_index" ON "putt_rounds" USING btree ("puzzle_date","mode");--> statement-breakpoint
CREATE INDEX "putt_rounds_user_id_index" ON "putt_rounds" USING btree ("user_id");