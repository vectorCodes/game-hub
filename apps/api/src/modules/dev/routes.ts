// Dev-only endpoints backing the angle picker (/dev/angles in the web app).
// Saving writes angles into assets/catalog.json and the database in one go.
import { writeFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { DevAnglesBody, type DevCatalogEntry } from "@shadow/shared";
import { z } from "zod";
import type { Db } from "../../db/client";
import { gameObjects } from "../../db/schema";
import { readCatalog } from "../../db/seed";
import { CATALOG_PATH } from "../../paths";
import { modelUrl, objectAngles } from "../shadow-guess/service";

export function devRoutes(app: FastifyInstance, db: Db, modelsBaseUrl: string) {
  app.get("/api/dev/catalog", async (): Promise<DevCatalogEntry[]> => {
    const rows = await db.select().from(gameObjects).orderBy(gameObjects.name);
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      category: o.category,
      modelUrl: modelUrl(modelsBaseUrl, o.modelKey),
      angles: objectAngles(o),
      customAngles: o.angles !== null,
    }));
  });

  app.put("/api/dev/catalog/:id/angles", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { angles } = DevAnglesBody.parse(req.body);

    const catalog = readCatalog();
    const entry = catalog.find((o) => o.id === id);
    if (!entry) return reply.code(404).send({ error: "not_found" });
    if (angles) entry.angles = angles;
    else delete entry.angles;
    writeFileSync(CATALOG_PATH, JSON.stringify({ objects: catalog }, null, 2) + "\n");

    await db.update(gameObjects).set({ angles }).where(eq(gameObjects.id, id));
    return { ok: true };
  });
}
