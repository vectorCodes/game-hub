CREATE TABLE "pair_pop_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"mode" text NOT NULL,
	"level" integer,
	"puzzle_date" date,
	"seed" text NOT NULL,
	"layout_seed" text NOT NULL,
	"moves" integer DEFAULT 0 NOT NULL,
	"best_combo" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"time_ms" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'playing' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pair_pop_games" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "pair_pop_games_puzzle_date_mode_index" ON "pair_pop_games" USING btree ("puzzle_date","mode");--> statement-breakpoint
CREATE INDEX "pair_pop_games_user_id_index" ON "pair_pop_games" USING btree ("user_id");