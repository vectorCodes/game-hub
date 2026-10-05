CREATE TABLE "climb_ghosts" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"frames" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "climb_ghosts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "climb_ghosts" ADD CONSTRAINT "climb_ghosts_run_id_climb_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."climb_runs"("id") ON DELETE cascade ON UPDATE no action;