CREATE TABLE "daily_puzzles" (
	"game_type" text NOT NULL,
	"date" date NOT NULL,
	"number" integer NOT NULL,
	"object_id" text NOT NULL,
	CONSTRAINT "daily_puzzles_game_type_date_pk" PRIMARY KEY("game_type","date")
);
--> statement-breakpoint
ALTER TABLE "daily_puzzles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "game_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" text NOT NULL,
	"difficulty" integer DEFAULT 2 NOT NULL,
	"model_key" text NOT NULL,
	"angles" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "game_objects_modelKey_unique" UNIQUE("model_key")
);
--> statement-breakpoint
ALTER TABLE "game_objects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"game_type" text NOT NULL,
	"mode" text NOT NULL,
	"puzzle_date" date,
	"object_id" text NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'playing' NOT NULL,
	"score" integer,
	"hint_used" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "game_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"text" text NOT NULL,
	"correct" boolean NOT NULL,
	"step" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guesses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_stats" (
	"user_id" uuid NOT NULL,
	"game_type" text NOT NULL,
	"played" integer DEFAULT 0 NOT NULL,
	"won" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"max_streak" integer DEFAULT 0 NOT NULL,
	"distribution" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "user_stats_user_id_game_type_pk" PRIMARY KEY("user_id","game_type")
);
--> statement-breakpoint
ALTER TABLE "user_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_puzzles" ADD CONSTRAINT "daily_puzzles_object_id_game_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."game_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_object_id_game_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."game_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_sessions_user_id_game_type_index" ON "game_sessions" USING btree ("user_id","game_type");--> statement-breakpoint
CREATE INDEX "guesses_session_id_index" ON "guesses" USING btree ("session_id");