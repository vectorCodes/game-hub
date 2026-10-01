import { buildApp } from "./app";
import { config } from "./config";
import { createDb } from "./db/client";
import { seedObjects } from "./db/seed";
import { startDailyPuzzleJob } from "./jobs/dailyPuzzle";

const handle = createDb(config);

if (handle.embedded) {
  // Local dev without Supabase: keep the embedded database migrated and in sync with
  // assets/catalog.json. PGlite is single-process, so `db:seed` can't run beside the server.
  await handle.migrate();
  // console.log(`Synced ${await seedObjects(handle.db)} objects into embedded PGlite.`);
}

const { app, shadowGuess } = await buildApp(handle.db, config, { logger: true });
const stopJob = startDailyPuzzleJob(shadowGuess, (msg) => app.log.error(msg));

const shutdown = async () => {
  stopJob();
  await app.close();
  await handle.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.port, host: config.host });
