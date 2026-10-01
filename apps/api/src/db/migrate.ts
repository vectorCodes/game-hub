import { config } from "../config";
import { createDb } from "./client";

const handle = createDb(config);
await handle.migrate();
await handle.close();
console.log(`Migrations applied (${handle.embedded ? "embedded PGlite" : "DATABASE_URL"}).`);
