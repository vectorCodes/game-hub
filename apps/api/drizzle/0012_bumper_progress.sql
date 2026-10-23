CREATE TABLE "bumper_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"matches" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"rounds_won" integer DEFAULT 0 NOT NULL,
	"kos" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bumper_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bumper_results" (
	"match_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"place" integer NOT NULL,
	"score" integer NOT NULL,
	"xp" integer NOT NULL,
	"coins" integer NOT NULL,
	"xp_before" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bumper_results_match_id_user_id_pk" PRIMARY KEY("match_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "bumper_results" ENABLE ROW LEVEL SECURITY;