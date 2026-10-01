import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNull, ne, notInArray, sql } from "drizzle-orm";
import {
  DEFAULT_ANGLES,
  MAX_STEPS,
  SKIPPED,
  computeScore,
  isCloseGuess,
  isCorrectGuess,
  normalizeGuess,
  type DailyInfo,
  type GameMode,
  type GuessResponse,
  type LightAngle,
  type RunView,
  type SessionView,
} from "@shadow/shared";
import type { Db, Executor } from "../../db/client";
import { dailyPuzzles, gameObjects, gameSessions, guesses } from "../../db/schema";
import { recordResult } from "../stats/service";

export const GAME_TYPE = "shadow-guess";
/** Daily puzzle #1. */
const LAUNCH_DATE = Date.UTC(2026, 8, 29);
/** A daily object isn't repeated within this many days. */
const DAILY_REPEAT_WINDOW = 60;

type SessionRow = typeof gameSessions.$inferSelect;
type ObjectRow = typeof gameObjects.$inferSelect;

export class NotFoundError extends Error {}

export function modelUrl(baseUrl: string, modelKey: string): string {
  return `${baseUrl}/${modelKey}.glb`;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function puzzleNumber(date: string): number {
  return Math.round((Date.parse(date) - LAUNCH_DATE) / 86_400_000) + 1;
}

export function objectAngles(object: Pick<ObjectRow, "angles">): LightAngle[] {
  return object.angles?.length === MAX_STEPS ? object.angles : DEFAULT_ANGLES;
}

export class ShadowGuessService {
  constructor(
    private db: Db,
    private modelsBaseUrl: string,
  ) {}

  async startSession(
    mode: GameMode,
    userId: string | null,
    previousSessionId?: string,
  ): Promise<SessionView> {
    let objectId: string;
    let puzzleDate: string | null = null;
    let runId: string | null = null;
    if (mode === "daily") {
      puzzleDate = todayUtc();
      // One daily per signed-in player: asking again resumes (or shows) today's session.
      if (userId) {
        const existing = await this.findDaily(this.db, userId, puzzleDate);
        if (existing) return this.getSession(existing.id, userId);
      }
      objectId = await this.ensureDailyPuzzle(puzzleDate);
    } else {
      const run = await this.continuedRun(userId, previousSessionId);
      runId = run?.runId ?? randomUUID();
      objectId = await this.pickFreeObject(run?.seen ?? (await this.objectOf(previousSessionId)));
    }
    const [session] = await this.db
      .insert(gameSessions)
      .values({ userId, gameType: GAME_TYPE, mode, puzzleDate, objectId, runId })
      .returning();
    return this.view(this.db, session, await this.getObject(objectId), []);
  }

  async getSession(id: string, userId: string | null): Promise<SessionView> {
    const session = await this.findSession(this.db, id, userId);
    const wrong = await this.wrongGuesses(this.db, id);
    return this.view(this.db, session, await this.getObject(session.objectId), wrong);
  }

  async guess(id: string, userId: string | null, text: string): Promise<GuessResponse> {
    return this.db.transaction(async (tx) => {
      const session = await this.findSession(tx, id, userId, true);
      const object = await this.getObject(session.objectId, tx);
      const wrong = await this.wrongGuesses(tx, id);
      if (session.status !== "playing") {
        return { result: "over", session: await this.view(tx, session, object, wrong) };
      }

      const answers = [object.name, ...object.aliases];
      if (isCorrectGuess(text, answers)) {
        await tx.insert(guesses).values({ sessionId: id, text, correct: true, step: session.step });
        const [updated] = await tx
          .update(gameSessions)
          .set({ status: "won", score: computeScore(session.step, session.hintUsed), endedAt: sql`now()` })
          .where(eq(gameSessions.id, id))
          .returning();
        await recordResult(tx, updated);
        return { result: "correct", session: await this.view(tx, updated, object, wrong) };
      }

      const normalized = normalizeGuess(text);
      if (wrong.some((g) => g !== SKIPPED && normalizeGuess(g) === normalized)) {
        return { result: "duplicate", session: await this.view(tx, session, object, wrong) };
      }
      const updated = await this.recordMiss(tx, session, text);
      return {
        result: "wrong",
        close: isCloseGuess(text, answers),
        session: await this.view(tx, updated, object, [...wrong, text]),
      };
    });
  }

  async skip(id: string, userId: string | null): Promise<SessionView> {
    return this.db.transaction(async (tx) => {
      const session = await this.findSession(tx, id, userId, true);
      const object = await this.getObject(session.objectId, tx);
      const wrong = await this.wrongGuesses(tx, id);
      if (session.status !== "playing") return this.view(tx, session, object, wrong);
      const updated = await this.recordMiss(tx, session, SKIPPED);
      return this.view(tx, updated, object, [...wrong, SKIPPED]);
    });
  }

  async hint(id: string, userId: string | null): Promise<SessionView> {
    const session = await this.findSession(this.db, id, userId);
    let updated = session;
    if (session.status === "playing" && !session.hintUsed) {
      [updated] = await this.db
        .update(gameSessions)
        .set({ hintUsed: true })
        .where(eq(gameSessions.id, id))
        .returning();
    }
    const wrong = await this.wrongGuesses(this.db, id);
    return this.view(this.db, updated, await this.getObject(session.objectId), wrong);
  }

  /**
   * Today's puzzle and how this player stands on it: by account when signed in, else by
   * the guest session id this browser remembers.
   */
  async dailyInfo(userId: string | null, guestSessionId?: string): Promise<DailyInfo> {
    const date = todayUtc();
    let session: SessionRow | undefined;
    if (userId) {
      const found = await this.findDaily(this.db, userId, date);
      if (found) [session] = await this.db.select().from(gameSessions).where(eq(gameSessions.id, found.id));
    } else if (guestSessionId) {
      [session] = await this.db
        .select()
        .from(gameSessions)
        .where(
          and(
            eq(gameSessions.id, guestSessionId),
            isNull(gameSessions.userId),
            eq(gameSessions.mode, "daily"),
            eq(gameSessions.puzzleDate, date),
          ),
        );
    }
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      puzzleNumber: puzzleNumber(date),
      date,
      status: session?.status ?? "new",
      score: session?.score ?? null,
      step: session ? session.step : null,
      nextAt: next.toISOString(),
    };
  }

  /**
   * Moves guest sessions from this browser into the signed-in account, counting finished
   * ones toward stats. Skips sessions already owned, and a guest daily when the account
   * already has that day's puzzle.
   */
  async claim(userId: string, sessionIds: string[]): Promise<number> {
    let claimed = 0;
    for (const id of sessionIds) {
      claimed += await this.db.transaction(async (tx) => {
        const [session] = await tx
          .select()
          .from(gameSessions)
          .where(and(eq(gameSessions.id, id), isNull(gameSessions.userId)))
          .for("update");
        if (!session) return 0;
        if (session.mode === "daily" && session.puzzleDate && (await this.findDaily(tx, userId, session.puzzleDate))) {
          return 0;
        }
        const [owned] = await tx
          .update(gameSessions)
          .set({ userId })
          .where(eq(gameSessions.id, id))
          .returning();
        await recordResult(tx, owned);
        return 1;
      });
    }
    return claimed;
  }

  /** Every possible answer, for autocomplete. Doesn't narrow down the current object. */
  async listNames(): Promise<string[]> {
    const rows = await this.db
      .select({ name: gameObjects.name })
      .from(gameObjects)
      .where(eq(gameObjects.active, true))
      .orderBy(asc(gameObjects.name));
    return rows.map((r) => r.name);
  }

  private async findDaily(db: Executor, userId: string, date: string) {
    const [row] = await db
      .select({ id: gameSessions.id })
      .from(gameSessions)
      .where(
        and(
          eq(gameSessions.userId, userId),
          eq(gameSessions.gameType, GAME_TYPE),
          eq(gameSessions.mode, "daily"),
          eq(gameSessions.puzzleDate, date),
        ),
      )
      .limit(1);
    return row;
  }

  private async recordMiss(tx: Executor, session: SessionRow, text: string): Promise<SessionRow> {
    await tx.insert(guesses).values({ sessionId: session.id, text, correct: false, step: session.step });
    const step = session.step + 1;
    const lost = step >= MAX_STEPS;
    const [updated] = await tx
      .update(gameSessions)
      .set(
        lost
          ? { step: MAX_STEPS - 1, status: "lost", score: 0, endedAt: sql`now()` }
          : { step },
      )
      .where(eq(gameSessions.id, session.id))
      .returning();
    if (lost) await recordResult(tx, updated);
    return updated;
  }

  private async findSession(db: Executor, id: string, userId: string | null, lock = false) {
    const query = db.select().from(gameSessions).where(eq(gameSessions.id, id));
    const [session] = await (lock ? query.for("update") : query);
    // Sessions owned by a user are invisible to everyone else; guest sessions are
    // protected only by their unguessable id.
    if (!session || (session.userId && session.userId !== userId)) {
      throw new NotFoundError("Session not found");
    }
    return session;
  }

  private async getObject(id: string, db: Executor = this.db): Promise<ObjectRow> {
    const [object] = await db.select().from(gameObjects).where(eq(gameObjects.id, id));
    return object;
  }

  private async wrongGuesses(db: Executor, sessionId: string): Promise<string[]> {
    const rows = await db
      .select({ text: guesses.text })
      .from(guesses)
      .where(and(eq(guesses.sessionId, sessionId), eq(guesses.correct, false)))
      .orderBy(asc(guesses.step));
    return rows.map((r) => r.text);
  }

  /** The object of a previous session, so free play doesn't serve it twice in a row. */
  private async objectOf(sessionId?: string): Promise<string[]> {
    if (!sessionId) return [];
    const [prev] = await this.db
      .select({ objectId: gameSessions.objectId })
      .from(gameSessions)
      .where(eq(gameSessions.id, sessionId));
    return prev ? [prev.objectId] : [];
  }

  /**
   * The run a new free round joins: the previous round's, if that round was solved by the
   * same player. Also returns the objects the run has already shown.
   */
  private async continuedRun(userId: string | null, previousSessionId?: string) {
    if (!previousSessionId) return null;
    const [prev] = await this.db.select().from(gameSessions).where(eq(gameSessions.id, previousSessionId));
    // A guest run carries over on sign-in (its sessions get claimed); otherwise owners must match.
    if (!prev?.runId || prev.status !== "won" || (prev.userId && prev.userId !== userId)) return null;
    const rows = await this.db
      .select({ objectId: gameSessions.objectId })
      .from(gameSessions)
      .where(eq(gameSessions.runId, prev.runId));
    return { runId: prev.runId, seen: rows.map((r) => r.objectId) };
  }

  private async pickFreeObject(exclude: string[] = []): Promise<string> {
    const pick = (avoid: string[]) =>
      this.db
        .select({ id: gameObjects.id })
        .from(gameObjects)
        .where(and(eq(gameObjects.active, true), avoid.length ? notInArray(gameObjects.id, avoid) : undefined))
        .orderBy(sql`random()`)
        .limit(1);
    let [row] = await pick(exclude);
    // A run longer than the catalog starts repeating objects.
    if (!row && exclude.length) [row] = await pick([]);
    if (!row) throw new Error("No active objects. Run `pnpm --filter api db:seed`.");
    return row.id;
  }

  /** Creates the day's puzzle if missing (lazily on first request, and ahead of time by the job). */
  async ensureDailyPuzzle(date: string): Promise<string> {
    const find = () =>
      this.db
        .select({ objectId: dailyPuzzles.objectId })
        .from(dailyPuzzles)
        .where(and(eq(dailyPuzzles.gameType, GAME_TYPE), eq(dailyPuzzles.date, date)));

    const [existing] = await find();
    if (existing) return existing.objectId;

    const cutoff = new Date(Date.parse(date) - DAILY_REPEAT_WINDOW * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const recent = this.db
      .select({ id: dailyPuzzles.objectId })
      .from(dailyPuzzles)
      .where(and(eq(dailyPuzzles.gameType, GAME_TYPE), gt(dailyPuzzles.date, cutoff)));
    const [fresh] = await this.db
      .select({ id: gameObjects.id })
      .from(gameObjects)
      .where(and(eq(gameObjects.active, true), notInArray(gameObjects.id, recent)))
      .orderBy(sql`random()`)
      .limit(1);
    const objectId = fresh?.id ?? (await this.pickFreeObject());

    // Concurrent first requests race here; the primary key keeps exactly one winner.
    await this.db
      .insert(dailyPuzzles)
      .values({ gameType: GAME_TYPE, date, number: puzzleNumber(date), objectId })
      .onConflictDoNothing();
    const [created] = await find();
    return created.objectId;
  }

  private async runView(db: Executor, session: SessionRow): Promise<RunView | null> {
    if (!session.runId) return null;
    const [run] = await db
      .select({
        solved: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')`.mapWith(Number),
        score: sql<number>`coalesce(sum(${gameSessions.score}), 0)`.mapWith(Number),
      })
      .from(gameSessions)
      .where(eq(gameSessions.runId, session.runId));
    let best: number | null = null;
    if (session.userId) {
      const runs = db
        .select({ solved: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')`.as("solved") })
        .from(gameSessions)
        .where(
          and(
            eq(gameSessions.userId, session.userId),
            eq(gameSessions.gameType, GAME_TYPE),
            ne(gameSessions.runId, session.runId),
          ),
        )
        .groupBy(gameSessions.runId)
        .as("runs");
      const [row] = await db.select({ best: sql<number>`coalesce(max(${runs.solved}), 0)`.mapWith(Number) }).from(runs);
      best = row.best;
    }
    return { id: session.runId, ...run, best };
  }

  private async view(db: Executor, session: SessionRow, object: ObjectRow, wrongGuesses: string[]): Promise<SessionView> {
    const over = session.status !== "playing";
    const angles = objectAngles(object);
    return {
      sessionId: session.id,
      mode: session.mode,
      puzzleNumber: session.puzzleDate ? puzzleNumber(session.puzzleDate) : null,
      modelUrl: modelUrl(this.modelsBaseUrl, object.modelKey),
      step: session.step,
      maxSteps: MAX_STEPS,
      angle: angles[session.step],
      angles: angles.slice(0, session.step + 1),
      status: session.status,
      wrongGuesses,
      hintUsed: session.hintUsed,
      category: session.hintUsed || over ? object.category : null,
      potentialScore: computeScore(session.step, session.hintUsed),
      score: session.score,
      answer: over ? object.name : null,
      run: await this.runView(db, session),
    };
  }
}
