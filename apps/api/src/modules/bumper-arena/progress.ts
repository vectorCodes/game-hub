import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  BUMPER_RESULTS_SECRET_HEADER,
  BumperResultsBody,
  bumperMatchCoins,
  bumperMatchXp,
  bumperProgress as progressView,
  levelForXp,
  xpForLevel,
  type BumperProgress,
  type BumperXpGain,
} from "@shadow/shared";
import type { Db } from "../../db/client";
import { bumperProgress, bumperResults, bumperRuns } from "../../db/schema";

function sameSecret(given: unknown, secret: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Bumper Arena levels and coins. Players read their progress; XP and coins only come from the
 * room (apps/realtime, BumperRoom) reporting a finished party match with the shared secret.
 */
export function bumperProgressRoutes(app: FastifyInstance, db: Db, resultsSecret: string | undefined) {
  const prefix = "/api/bumper-arena";

  app.get(`${prefix}/progress`, async (req, reply): Promise<BumperProgress | undefined> => {
    if (!req.userId) return void reply.code(401).send({ error: "sign_in_required" });
    const [row] = await db.select().from(bumperProgress).where(eq(bumperProgress.userId, req.userId));
    const [best] = await db
      .select({ waves: bumperRuns.waves, score: bumperRuns.score })
      .from(bumperRuns)
      .where(and(eq(bumperRuns.userId, req.userId), eq(bumperRuns.status, "finished")))
      .orderBy(desc(bumperRuns.waves), desc(bumperRuns.score))
      .limit(1);
    return progressView(row ?? { xp: 0, matches: 0, wins: 0, roundsWon: 0, kos: 0, coins: 0 }, best ?? null);
  });

  app.post(`${prefix}/results`, async (req, reply) => {
    if (!resultsSecret) return reply.code(503).send({ error: "not_configured" });
    if (!sameSecret(req.headers[BUMPER_RESULTS_SECRET_HEADER], resultsSecret)) return reply.code(401).send({ error: "bad_secret" });
    const { matchId, players } = BumperResultsBody.parse(req.body);
    const gains: BumperXpGain[] = [];
    for (const p of players) {
      const gain = await db.transaction(async (tx) => {
        // Reported before (a retry): the same answer again, nothing added.
        const [done] = await tx.select().from(bumperResults).where(and(eq(bumperResults.matchId, matchId), eq(bumperResults.userId, p.userId)));
        if (done) return { before: done.xpBefore, xp: done.xpBefore + done.xp, gained: done.xp, coins: done.coins };
        const xp = bumperMatchXp(p.score, p.place, p.dnf);
        const coins = bumperMatchCoins(p.roundWins, p.kos, p.dnf);
        const win = p.place === 1 && !p.dnf ? 1 : 0;
        const [row] = await tx
          .insert(bumperProgress)
          .values({ userId: p.userId, xp, matches: 1, wins: win, roundsWon: p.roundWins, kos: p.kos, coins })
          .onConflictDoUpdate({
            target: bumperProgress.userId,
            set: {
              xp: sql`${bumperProgress.xp} + ${xp}`,
              matches: sql`${bumperProgress.matches} + 1`,
              wins: sql`${bumperProgress.wins} + ${win}`,
              roundsWon: sql`${bumperProgress.roundsWon} + ${p.roundWins}`,
              kos: sql`${bumperProgress.kos} + ${p.kos}`,
              coins: sql`${bumperProgress.coins} + ${coins}`,
              updatedAt: new Date(),
            },
          })
          .returning({ xp: bumperProgress.xp });
        const before = row.xp - xp;
        await tx.insert(bumperResults).values({ matchId, userId: p.userId, place: p.place, score: p.score, xp, coins, xpBefore: before });
        return { before, xp: row.xp, gained: xp, coins };
      });
      const level = levelForXp(gain.xp);
      gains.push({
        userId: p.userId,
        gained: gain.gained,
        coins: gain.coins,
        xp: gain.xp,
        levelBefore: levelForXp(gain.before),
        level,
        levelXp: xpForLevel(level),
        nextLevelXp: xpForLevel(level + 1),
      });
    }
    return { players: gains };
  });
}
