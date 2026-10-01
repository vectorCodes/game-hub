import type { SQL } from "drizzle-orm";
import type { Db } from "./client";

/** Runs raw SQL; postgres-js returns an array of rows and PGlite returns `{ rows }`. */
export async function queryRows<T>(db: Db, query: SQL): Promise<T[]> {
  const result = (await db.execute(query)) as unknown as T[] | { rows: T[] };
  return Array.isArray(result) ? result : result.rows;
}
