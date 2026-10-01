import { and, eq } from "drizzle-orm";
import { MAX_STEPS, type StatsView } from "@shadow/shared";
import type { Db, Executor } from "../../db/client";
import { gameSessions, userStats } from "../../db/schema";

type SessionRow = typeof gameSessions.$inferSelect;
type StatsRow = typeof userStats.$inferSelect;

function dayBefore(date: string): string {
  return new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);
}

/** Folds one finished session into the owner's stats. Call once, when the session ends. */
export async function recordResult(db: Executor, session: SessionRow): Promise<void> {
  if (!session.userId || session.status === "playing") return;
  const won = session.status === "won";

  const [row] = await db
    .select()
    .from(userStats)
    .where(and(eq(userStats.userId, session.userId), eq(userStats.gameType, session.gameType)))
    .for("update");

  const distribution = Array.from({ length: MAX_STEPS }, (_, i) => row?.distribution[i] ?? 0);
  if (won) distribution[session.step]++;

  let currentStreak = row?.currentStreak ?? 0;
  let lastDailyDate = row?.lastDailyDate ?? null;
  if (session.mode === "daily" && session.puzzleDate) {
    const continues = lastDailyDate === dayBefore(session.puzzleDate) && currentStreak > 0;
    currentStreak = won ? (continues ? currentStreak + 1 : 1) : 0;
    lastDailyDate = session.puzzleDate;
  }

  const values = {
    played: (row?.played ?? 0) + 1,
    won: (row?.won ?? 0) + (won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(row?.maxStreak ?? 0, currentStreak),
    lastDailyDate,
    distribution,
  };
  await db
    .insert(userStats)
    .values({ userId: session.userId, gameType: session.gameType, ...values })
    .onConflictDoUpdate({ target: [userStats.userId, userStats.gameType], set: values });
}

export async function getStats(db: Db, userId: string, gameType: string): Promise<StatsView> {
  const [row] = await db
    .select()
    .from(userStats)
    .where(and(eq(userStats.userId, userId), eq(userStats.gameType, gameType)));
  return toView(row);
}

function toView(row: StatsRow | undefined): StatsView {
  const today = new Date().toISOString().slice(0, 10);
  // A streak survives until a day is skipped: it must end today or yesterday.
  const alive = row?.lastDailyDate === today || row?.lastDailyDate === dayBefore(today);
  return {
    played: row?.played ?? 0,
    won: row?.won ?? 0,
    currentStreak: alive ? (row?.currentStreak ?? 0) : 0,
    maxStreak: row?.maxStreak ?? 0,
    distribution: Array.from({ length: MAX_STEPS }, (_, i) => row?.distribution[i] ?? 0),
  };
}

