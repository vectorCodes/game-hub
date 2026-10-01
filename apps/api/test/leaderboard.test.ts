import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import type { DailyInfo, LeaderboardView, SessionView } from "@shadow/shared";
import { buildApp } from "../src/app";
import { createDb, type DbHandle } from "../src/db/client";
import { gameObjects, gameSessions } from "../src/db/schema";
import { seedObjects } from "../src/db/seed";
import { shortName } from "../src/modules/leaderboard/service";

const SECRET = "test-secret-at-least-32-characters-long!!";
let handle: DbHandle;
let app: FastifyInstance;

beforeAll(async () => {
  handle = createDb({});
  await handle.migrate();
  await seedObjects(handle.db);
  ({ app } = await buildApp(handle.db, {
    corsOrigin: [],
    modelsBaseUrl: "/models",
    serveModels: false,
    isProd: false,
    supabaseUrl: undefined,
    supabaseJwtSecret: SECRET,
  }));
});

afterAll(async () => {
  await app.close();
  await handle.close();
});

const token = (sub: string, name: string) =>
  new SignJWT({ user_metadata: { full_name: name } })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));

async function call<T>(method: "GET" | "POST", url: string, auth?: string, body?: object) {
  const res = await app.inject({
    method,
    url,
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
    ...(method === "POST" ? { payload: body ?? {} } : {}),
  });
  return res.json() as T;
}

/** Plays today's daily as `t`, missing `misses` times before answering. */
async function playDaily(t: string, misses: number) {
  const s = await call<SessionView>("POST", "/api/shadow-guess/sessions", t, { mode: "daily" });
  await call("GET", "/api/me", t); // creates the profile
  for (let i = 0; i < misses; i++) await call("POST", `/api/shadow-guess/sessions/${s.sessionId}/skip`, t);
  const [row] = await handle.db.select().from(gameSessions).where(eq(gameSessions.id, s.sessionId));
  const [object] = await handle.db.select().from(gameObjects).where(eq(gameObjects.id, row.objectId));
  await call("POST", `/api/shadow-guess/sessions/${s.sessionId}/guess`, t, { text: object.name });
}

describe("leaderboard", () => {
  it("shortens names", () => {
    expect(shortName("Ada Lovelace")).toBe("Ada L.");
    expect(shortName("Cher")).toBe("Cher");
    expect(shortName(null)).toBe("Anonymous");
  });

  it("ranks today's daily by score and marks the caller", async () => {
    const ada = await token("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Ada Lovelace");
    const bob = await token("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Bob Stone");
    await playDaily(ada, 2); // 70
    await playDaily(bob, 0); // 100

    const board = await call<LeaderboardView>("GET", "/api/leaderboard?period=daily", ada);
    expect(board.totalPlayers).toBe(2);
    expect(board.entries.map((e) => [e.rank, e.name, e.score])).toEqual([
      [1, "Bob S.", 100],
      [2, "Ada L.", 70],
    ]);
    expect(board.me).toMatchObject({ rank: 2, isMe: true });
    expect(JSON.stringify(board)).not.toContain("aaaaaaaa-");

    const guest = await call<LeaderboardView>("GET", "/api/leaderboard?period=all");
    expect(guest.me).toBeNull();
    expect(guest.entries).toHaveLength(2);
  });

  it("reports today's daily status", async () => {
    const t = await token("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "Cy");
    const before = await call<DailyInfo>("GET", "/api/shadow-guess/daily", t);
    expect(before).toMatchObject({ status: "new", score: null });
    await playDaily(t, 1);
    const after = await call<DailyInfo>("GET", "/api/shadow-guess/daily", t);
    expect(after).toMatchObject({ status: "won", score: 85, puzzleNumber: before.puzzleNumber });
    expect(Date.parse(after.nextAt)).toBeGreaterThan(Date.now());
  });
});
