import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { MIGRATIONS_DIR } from "../paths";
import * as schema from "./schema";

// Both drivers expose the same query builder; typed as postgres-js for one shared type.
export type Db = PostgresJsDatabase<typeof schema>;
/** A database or an open transaction. */
export type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface DbHandle {
  db: Db;
  embedded: boolean;
  migrate(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Supabase Postgres when `databaseUrl` is set; otherwise embedded PGlite
 * (persisted to `pgliteDir`, or in-memory when that's undefined, as in tests).
 */
export function createDb(opts: { databaseUrl?: string; pgliteDir?: string }): DbHandle {
  const migrationsFolder = MIGRATIONS_DIR;
  if (opts.databaseUrl) {
    // prepare: false is required by Supabase's transaction-mode pooler.
    const client = postgres(opts.databaseUrl, { prepare: false });
    const db = drizzlePostgres(client, { schema, casing: "snake_case" });
    return {
      db,
      embedded: false,
      migrate: () => migratePostgres(db, { migrationsFolder }),
      close: () => client.end(),
    };
  }
  const client = new PGlite(opts.pgliteDir);
  const db = drizzlePglite(client, { schema, casing: "snake_case" });
  return {
    db: db as unknown as Db,
    embedded: true,
    migrate: () => migratePglite(db, { migrationsFolder }),
    close: () => client.close(),
  };
}
