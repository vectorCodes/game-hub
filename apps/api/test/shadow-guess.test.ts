import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { DEFAULT_ANGLES, MAX_STEPS, type AlbumView, type GuessResponse, type SessionView } from "@shadow/shared";
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

  it("flags a wrong guess that's near the answer", async () => {
    const s = await start();
    const object = await answerOf(s.sessionId);
    const word = object.name.split(" ").reduce((a, b) => (b.length > a.length ? b : a));

    const warm = await post<GuessResponse>(`/api/shadow-guess/sessions/${s.sessionId}/guess`, {
      text: `${word} contraption`,
    });
    expect(warm.body.result).toBe("wrong");
    expect(warm.body.close).toBe(true);
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

  it("chains solved free rounds into a run and ends it on a loss", async () => {
    const solve = async (id: string) =>
      (await post<GuessResponse>(`/api/shadow-guess/sessions/${id}/guess`, { text: (await answerOf(id)).name })).body
        .session;

    const first = await start();
    expect(first.run).toMatchObject({ solved: 0, score: 0, best: null });
    const won = await solve(first.sessionId);
    expect(won.run).toMatchObject({ solved: 1, score: 100 });

    const second = (
      await post<SessionView>("/api/shadow-guess/sessions", { mode: "free", previousSessionId: first.sessionId })
    ).body;
    expect(second.run).toMatchObject({ id: first.run!.id, solved: 1, score: 100 });
    expect((await answerOf(second.sessionId)).id).not.toBe((await answerOf(first.sessionId)).id);

    let lost = second;
    for (let i = 0; i < MAX_STEPS; i++) {
      lost = (await post<SessionView>(`/api/shadow-guess/sessions/${second.sessionId}/skip`)).body;
    }
    expect(lost.run).toMatchObject({ solved: 1, score: 100 });

    // After a loss, the next round starts a fresh run.
    const third = (
      await post<SessionView>("/api/shadow-guess/sessions", { mode: "free", previousSessionId: second.sessionId })
    ).body;
    expect(third.run).toMatchObject({ solved: 0, score: 0 });
    expect(third.run!.id).not.toBe(first.run!.id);
  });

  it("builds a guest album from this browser's won sessions only", async () => {
    const s = await start();
    const object = await answerOf(s.sessionId);
    const empty = (await post<AlbumView>("/api/shadow-guess/album", { sessionIds: [s.sessionId] })).body;
    expect(empty.found).toBe(0);
    expect(empty.total).toBeGreaterThan(0);
    expect(empty.categories.every((c) => c.found.length === 0)).toBe(true);

    await post(`/api/shadow-guess/sessions/${s.sessionId}/guess`, { text: object.name });
    const album = (await post<AlbumView>("/api/shadow-guess/album", { sessionIds: [s.sessionId] })).body;
    expect(album.found).toBe(1);
    const category = album.categories.find((c) => c.name === object.category)!;
    expect(category.found).toMatchObject([{ id: object.id, name: object.name, solves: 1, bestAngle: 1 }]);

    // Without the session ids, a guest sees nothing.
    expect((await post<AlbumView>("/api/shadow-guess/album")).body.found).toBe(0);
  });

  it("keeps daily puzzles out of runs", async () => {
    expect((await start("daily")).run).toBeNull();
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
