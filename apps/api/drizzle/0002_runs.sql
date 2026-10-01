ALTER TABLE "game_sessions" ADD COLUMN "run_id" uuid;--> statement-breakpoint
CREATE INDEX "game_sessions_run_id_index" ON "game_sessions" USING btree ("run_id");