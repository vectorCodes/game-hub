import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb, type DbHandle } from "../src/db/client";
import { gameObjects } from "../src/db/schema";
import { readCatalog, seedObjects } from "../src/db/seed";
import { ShadowGuessService } from "../src/modules/shadow-guess/service";
import { checkThemes, readThemes, type Theme } from "../src/themes";

let handle: DbHandle;

beforeAll(async () => {
  handle = createDb({}); // in-memory PGlite
  await handle.migrate();
  await seedObjects(handle.db);
});

afterAll(async () => {
  await handle.close();
});

const today = new Date().toISOString().slice(0, 10);

function theme(over: Partial<Theme>): Theme {
  return { id: "t", name: "Test Week", emoji: "🧪", start: "2030-01-06", end: "2030-01-12", categories: [], objects: [], ...over };
}

function days(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => new Date(Date.parse(start) + i * 86_400_000).toISOString().slice(0, 10));
}

async function categoriesOf(ids: string[]) {
  const rows = await handle.db.select().from(gameObjects).where(inArray(gameObjects.id, ids));
  return ids.map((id) => rows.find((r) => r.id === id)!.category);
}

describe("themed weeks", () => {
  it("draws every themed day from the theme, without repeats while it can", async () => {
    const service = new ShadowGuessService(handle.db, "/models", [theme({ categories: ["Space"], objects: ["toaster"] })]);
    const picked = [];
    for (const date of days("2030-01-06", 7)) picked.push(await service.ensureDailyPuzzle(date));
    expect(new Set(picked).size).toBe(7);
    for (const [i, category] of (await categoriesOf(picked)).entries()) {
      expect(category === "Space" || picked[i] === "toaster").toBe(true);
    }
  });

  it("keeps ordinary days off the objects of an upcoming theme", async () => {
    const service = new ShadowGuessService(handle.db, "/models", [
      theme({ start: "2031-02-01", end: "2031-02-07", categories: ["Animals"] }),
    ]);
    const picked = [];
    for (const date of days("2031-01-05", 27)) picked.push(await service.ensureDailyPuzzle(date));
    expect(await categoriesOf(picked)).not.toContain("Animals");
  });

  it("stays on theme once the theme runs out of fresh objects", async () => {
    const service = new ShadowGuessService(handle.db, "/models", [
      theme({ start: "2032-03-01", end: "2032-03-03", objects: ["toaster"] }),
    ]);
    for (const date of days("2032-03-01", 3)) expect(await service.ensureDailyPuzzle(date)).toBe("toaster");
  });

  it("shows the theme on the daily and its sessions, not on free play", async () => {
    const service = new ShadowGuessService(handle.db, "/models", [
      theme({ id: "today", start: today, end: today, objects: ["cat", "dog"] }),
    ]);
    const info = await service.dailyInfo(null);
    expect(info.theme).toEqual({ id: "today", name: "Test Week", emoji: "🧪", start: today, end: today });
    const daily = await service.startSession("daily", null);
    expect(daily.theme?.id).toBe("today");
    expect((await service.startSession("free", null)).theme).toBeNull();
  });

  it("leaves the label off a puzzle picked before its theme was scheduled", async () => {
    // Today's puzzle already exists (a cat or a dog, from the test above).
    const service = new ShadowGuessService(handle.db, "/models", [
      theme({ id: "later", start: today, end: today, objects: ["toaster"] }),
    ]);
    expect((await service.dailyInfo(null)).theme).toBeNull();
    expect((await service.startSession("daily", null)).theme).toBeNull();
  });

  it("rejects overlapping themes and unknown objects", () => {
    const dir = mkdtempSync(join(tmpdir(), "themes-"));
    const file = join(dir, "themes.json");
    writeFileSync(file, JSON.stringify({ themes: [theme({ id: "a", objects: ["cat"] }), theme({ id: "b", start: "2030-01-12", end: "2030-01-20", objects: ["dog"] })] }));
    expect(() => readThemes(file)).toThrow(/overlap/);
    expect(() => checkThemes([theme({ objects: ["unicorn"] })], readCatalog())).toThrow(/unicorn/);
  });

  it("ships a valid schedule", () => {
    expect(() => checkThemes(readThemes(), readCatalog())).not.toThrow();
  });
});
