import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { eq } from "drizzle-orm";
import type { GuessResponse, MeView, SessionView } from "@shadow/shared";
import { buildApp } from "../src/app";
import { createDb, type DbHandle } from "../src/db/client";
import { gameObjects, gameSessions } from "../src/db/schema";
import { seedObjects } from "../src/db/seed";

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

async function token(sub: string, name = "Ada Lovelace") {
  return new SignJWT({ user_metadata: { full_name: name, avatar_url: "https://example.com/a.png" } })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

async function call<T>(method: "GET" | "POST", url: string, auth?: string, body?: object) {
  const res = await app.inject({
    method,
    url,
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
    ...(method === "POST" ? { payload: body ?? {} } : {}),
  });
  return { status: res.statusCode, body: res.json() as T };
}

async function answerOf(sessionId: string) {
  const [s] = await handle.db.select().from(gameSessions).where(eq(gameSessions.id, sessionId));
  const [o] = await handle.db.select().from(gameObjects).where(eq(gameObjects.id, s.objectId));
  return o.name;
}

describe("signed-in players", () => {
  it("requires a token for /api/me and builds the profile from Google metadata", async () => {
    expect((await call("GET", "/api/me")).status).toBe(401);
    const me = await call<MeView>("GET", "/api/me", await token("11111111-1111-4111-8111-111111111111"));
    expect(me.status).toBe(200);
    expect(me.body.profile).toMatchObject({ displayName: "Ada Lovelace", avatarUrl: "https://example.com/a.png" });
    expect(me.body.stats).toMatchObject({ played: 0, won: 0, currentStreak: 0 });
  });

  it("gets one daily per day and records stats and streak", async () => {
    const t = await token("22222222-2222-4222-8222-222222222222");
    const a = (await call<SessionView>("POST", "/api/shadow-guess/sessions", t, { mode: "daily" })).body;
    const b = (await call<SessionView>("POST", "/api/shadow-guess/sessions", t, { mode: "daily" })).body;
    expect(b.sessionId).toBe(a.sessionId);

    await call("POST", `/api/shadow-guess/sessions/${a.sessionId}/skip`, t);
    const win = await call<GuessResponse>("POST", `/api/shadow-guess/sessions/${a.sessionId}/guess`, t, {
      text: await answerOf(a.sessionId),
    });
    expect(win.body.result).toBe("correct");

    const { stats } = (await call<MeView>("GET", "/api/me", t)).body;
    expect(stats).toMatchObject({ played: 1, won: 1, currentStreak: 1, maxStreak: 1 });
    expect(stats.distribution).toEqual([0, 1, 0, 0, 0, 0]);

    // Finished today: starting the daily again shows the same finished session.
    const again = (await call<SessionView>("POST", "/api/shadow-guess/sessions", t, { mode: "daily" })).body;
    expect(again).toMatchObject({ sessionId: a.sessionId, status: "won" });
  });

  it("hides a player's session from everyone else", async () => {
    const t = await token("33333333-3333-4333-8333-333333333333");
    const s = (await call<SessionView>("POST", "/api/shadow-guess/sessions", t, { mode: "free" })).body;
    expect((await call("GET", `/api/shadow-guess/sessions/${s.sessionId}`)).status).toBe(404);
    const other = await token("44444444-4444-4444-8444-444444444444");
    expect((await call("GET", `/api/shadow-guess/sessions/${s.sessionId}`, other)).status).toBe(404);
  });

  it("claims finished guest games into the account", async () => {
    const guest = (await call<SessionView>("POST", "/api/shadow-guess/sessions", undefined, { mode: "free" })).body;
    for (let i = 0; i < 6; i++) await call("POST", `/api/shadow-guess/sessions/${guest.sessionId}/skip`);

    const t = await token("55555555-5555-4555-8555-555555555555");
    const res = await call<{ claimed: number }>("POST", "/api/me/claim", t, { sessionIds: [guest.sessionId] });
    expect(res.body.claimed).toBe(1);
    expect((await call<MeView>("GET", "/api/me", t)).body.stats).toMatchObject({ played: 1, won: 0 });

    // Claiming twice, or someone else's claimed game, does nothing.
    const again = await call<{ claimed: number }>("POST", "/api/me/claim", t, { sessionIds: [guest.sessionId] });
    expect(again.body.claimed).toBe(0);
    expect((await call("GET", `/api/shadow-guess/sessions/${guest.sessionId}`)).status).toBe(404);
  });
});
