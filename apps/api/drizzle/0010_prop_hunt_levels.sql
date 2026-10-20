CREATE TABLE "hunt_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"taunts" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hunt_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hunt_results" (
	"match_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"place" integer NOT NULL,
	"xp" integer NOT NULL,
	"xp_before" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hunt_results_match_id_user_id_pk" PRIMARY KEY("match_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "hunt_results" ENABLE ROW LEVEL SECURITY;