import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { DEFAULT_ANGLES, MAX_STEPS, type GuessResponse, type SessionView } from "@shadow/shared";
import { buildApp } from "../src/app";
import { createDb, type DbHandle } from "../src/db/client";
import { gameObjects, gameSessions } from "../src/db/schema";
import { seedObjects } from "../src/db/seed";

let handle: DbHandle;
let app: FastifyInstance;

beforeAll(async () => {
  handle = createDb({}); // in-memory PGlite
  await handle.migrate();
  await seedObjects(handle.db);
  ({ app } = await buildApp(handle.db, {
    corsOrigin: ["http://localhost:5173"],
    modelsBaseUrl: "/models",
    serveModels: true,
    isProd: false,
    supabaseUrl: undefined,
    supabaseJwtSecret: undefined,
  }));
});

afterAll(async () => {
  await app.close();
  await handle.close();
});

async function post<T>(url: string, body: object = {}) {
  const res = await app.inject({ method: "POST", url, payload: body });
  return { status: res.statusCode, body: res.json() as T, raw: res.body };
}

async function start(mode: "free" | "daily" = "free") {
  return (await post<SessionView>("/api/shadow-guess/sessions", { mode })).body;
}

async function answerOf(sessionId: string) {
  const [session] = await handle.db.select().from(gameSessions).where(eq(gameSessions.id, sessionId));
  const [object] = await handle.db.select().from(gameObjects).where(eq(gameObjects.id, session.objectId));
  return object;
}

function wrongGuessFor(answer: string) {
  return answer === "Toaster" ? "Canoe" : "Toaster";
}

describe("shadow guess API", () => {
  it("starts a session without leaking the answer", async () => {
    const res = await post<SessionView>("/api/shadow-guess/sessions", { mode: "free" });
    expect(res.status).toBe(200);
    const object = await answerOf(res.body.sessionId);
    expect(res.body).toMatchObject({ status: "playing", step: 0, answer: null, category: null });
    expect(res.body.modelUrl).toBe(`/models/${object.modelKey}.glb`);
    expect(res.body.angle).toEqual((object.angles ?? DEFAULT_ANGLES)[0]);
    for (const secret of [object.id, object.name, ...object.aliases]) {
      expect(res.raw.toLowerCase()).not.toContain(`"${secret.toLowerCase()}"`);
    }
  });

  it("advances the light on a wrong guess and ignores duplicates", async () => {
    const s = await start();
    const object = await answerOf(s.sessionId);
    const wrong = wrongGuessFor(object.name);

    const miss = await post<GuessResponse>(`/api/shadow-guess/sessions/${s.sessionId}/guess`, { text: wrong });
    expect(miss.body.result).toBe("wrong");
    expect(miss.body.session.step).toBe(1);
    expect(miss.body.session.angle).toEqual((object.angles ?? DEFAULT_ANGLES)[1]);
    expect(miss.body.session.angles).toEqual((object.angles ?? DEFAULT_ANGLES).slice(0, 2));
    expect(miss.body.session.answer).toBeNull();
    expect(miss.raw).not.toContain(`"${object.name}"`);

    const dup = await post<GuessResponse>(`/api/shadow-guess/sessions/${s.sessionId}/guess`, {
      text: ` ${wrong.toUpperCase()} `,
    });
    expect(dup.body.result).toBe("duplicate");
    expect(dup.body.session.step).toBe(1);
  });

  it("scores a correct guess server-side and reveals the answer", async () => {
    const s = await start();
    const object = await answerOf(s.sessionId);
    await post(`/api/shadow-guess/sessions/${s.sessionId}/guess`, { text: wrongGuessFor(object.name) });
    await post(`/api/shadow-guess/sessions/${s.sessionId}/hint`);

    const hit = await post<GuessResponse>(`/api/shadow-guess/sessions/${s.sessionId}/guess`, {
      text: object.name.toLowerCase(),
    });
    expect(hit.body.result).toBe("correct");
    expect(hit.body.session).toMatchObject({ status: "won", score: 75, answer: object.name });

    const after = await post<GuessResponse>(`/api/shadow-guess/sessions/${s.sessionId}/guess`, { text: "x" });
    expect(after.body.result).toBe("over");
  });

  it("loses after running out of angles", async () => {
    const s = await start();
    let view = s;
    for (let i = 0; i < MAX_STEPS; i++) {
      view = (await post<SessionView>(`/api/shadow-guess/sessions/${s.sessionId}/skip`)).body;
    }
    expect(view).toMatchObject({ status: "lost", score: 0, step: MAX_STEPS - 1 });
    expect(view.wrongGuesses).toHaveLength(MAX_STEPS);
    expect(view.answer).toBe((await answerOf(s.sessionId)).name);
  });

  it("serves the same daily object to everyone", async () => {
    const a = await start("daily");
    const b = await start("daily");
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(a.modelUrl).toBe(b.modelUrl);
    expect(a.puzzleNumber).toBeGreaterThan(0);
    expect(a.puzzleNumber).toBe(b.puzzleNumber);
  });

  it("validates input", async () => {
    expect((await post("/api/shadow-guess/sessions", { mode: "ranked" })).status).toBe(400);
    const s = await start();
    expect((await post(`/api/shadow-guess/sessions/${s.sessionId}/guess`, { text: "" })).status).toBe(400);
    const missing = "00000000-0000-4000-8000-000000000000";
    expect((await post(`/api/shadow-guess/sessions/${missing}/skip`)).status).toBe(404);
  });

  it("rejects an invalid bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/shadow-guess/objects/names",
      headers: { authorization: "Bearer nope" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("serves opaque model files", async () => {
    const s = await start();
    const res = await app.inject({ method: "GET", url: s.modelUrl });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("immutable");
  });
});
