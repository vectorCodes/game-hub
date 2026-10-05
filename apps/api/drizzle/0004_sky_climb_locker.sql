CREATE TABLE "climb_loadouts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"character" text NOT NULL,
	"trail" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "climb_loadouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "climb_unlocks" (
	"user_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"cost" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "climb_unlocks_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "climb_unlocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "climb_runs" ADD COLUMN "clean_floor" integer DEFAULT 0 NOT NULL;