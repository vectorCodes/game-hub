import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import type { LightAngle } from "@shadow/shared";
import { CATALOG_PATH, MANIFEST_PATH } from "../paths";
import { checkThemes, readThemes } from "../themes";
import type { Db } from "./client";
import { gameObjects } from "./schema";

export interface CatalogEntry {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  difficulty: number;
  source: string;
  angles?: LightAngle[];
  active?: boolean;
}

export function readCatalog(): CatalogEntry[] {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8")).objects;
}

/**
 * Upserts assets/catalog.json joined with the model manifest into game_objects. Also checks
 * that assets/themes.json only names objects and categories that exist.
 */
export async function seedObjects(db: Db): Promise<number> {
  const manifest: Record<string, string> = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const catalog = readCatalog();
  checkThemes(readThemes(), catalog);
  const rows = catalog.map((o) => {
    const modelKey = manifest[o.id];
    if (!modelKey) throw new Error(`${o.id} has no built model. Run \`pnpm models:build\`.`);
    return {
      id: o.id,
      name: o.name,
      aliases: o.aliases,
      category: o.category,
      difficulty: o.difficulty,
      modelKey,
      angles: o.angles ?? null,
      active: o.active ?? true,
    };
  });
  await db
    .insert(gameObjects)
    .values(rows)
    .onConflictDoUpdate({
      target: gameObjects.id,
      set: {
        name: sql`excluded.name`,
        aliases: sql`excluded.aliases`,
        category: sql`excluded.category`,
        difficulty: sql`excluded.difficulty`,
        modelKey: sql`excluded.model_key`,
        angles: sql`excluded.angles`,
        active: sql`excluded.active`,
      },
    });
  return rows.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { config } = await import("../config");
  const { createDb } = await import("./client");
  const handle = createDb(config);
  if (handle.embedded) await handle.migrate();
  console.log(`Seeded ${await seedObjects(handle.db)} objects.`);
  await handle.close();
}
