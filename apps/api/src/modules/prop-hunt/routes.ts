import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import {
  HUNT_RESULTS_SECRET_HEADER,
  HuntLoadoutBody,
  HuntResultsBody,
  huntProgress as progressView,
  levelForXp,
  matchXp,
  tauntsAt,
  xpForLevel,
  type HuntProgress,
  type HuntXpGain,
} from "@shadow/shared";
import type { Db } from "../../db/client";
import { huntProgress, huntResults } from "../../db/schema";

function requireUser(req: FastifyRequest, reply: FastifyReply): string | null {
  if (!req.userId) void reply.code(401).send({ error: "sign_in_required" });
  return req.userId;
}

function sameSecret(given: unknown, secret: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Prop Hunt levels. Players read their progress and pick their taunts; XP only comes from the
 * room (apps/realtime, HuntRoom) reporting a finished match with the shared secret.
 */
export function propHuntRoutes(app: FastifyInstance, db: Db, resultsSecret: string | undefined) {
  const progress = async (userId: string): Promise<HuntProgress> => {
    const [row] = await db.select().from(huntProgress).where(eq(huntProgress.userId, userId));
    return progressView(row ?? { xp: 0, matches: 0, wins: 0, taunts: null });
  };

  app.get("/api/hunt/progress", async (req, reply) => {
    const userId = requireUser(req, reply);
    if (userId) return progress(userId);
  });

  app.post("/api/hunt/loadout", async (req, reply) => {
    const userId = requireUser(req, reply);
    if (!userId) return;
    const { taunts } = HuntLoadoutBody.parse(req.body);
    const { unlocked } = await progress(userId);
    if (taunts.some((t) => !unlocked.includes(t as (typeof unlocked)[number]))) return reply.code(422).send({ error: "locked" });
    const picked = [...new Set(taunts)];
    await db
      .insert(huntProgress)
      .values({ userId, taunts: picked })
      .onConflictDoUpdate({ target: huntProgress.userId, set: { taunts: picked, updatedAt: new Date() } });
    return progress(userId);
  });

  app.post("/api/hunt/results", async (req, reply) => {
    if (!resultsSecret) return reply.code(503).send({ error: "not_configured" });
    if (!sameSecret(req.headers[HUNT_RESULTS_SECRET_HEADER], resultsSecret)) return reply.code(401).send({ error: "bad_secret" });
    const { matchId, players } = HuntResultsBody.parse(req.body);
    const gains: HuntXpGain[] = [];
    for (const p of players) {
      const gain = await db.transaction(async (tx) => {
        // Reported before (a retry): the same answer again, nothing added.
        const [done] = await tx.select().from(huntResults).where(and(eq(huntResults.matchId, matchId), eq(huntResults.userId, p.userId)));
        if (done) return { before: done.xpBefore, xp: done.xpBefore + done.xp, gained: done.xp };
        const xp = matchXp(p.score, p.place, p.dnf);
        const [row] = await tx
          .insert(huntProgress)
          .values({ userId: p.userId, xp, matches: 1, wins: p.place === 1 && !p.dnf ? 1 : 0 })
          .onConflictDoUpdate({
            target: huntProgress.userId,
            set: {
              xp: sql`${huntProgress.xp} + ${xp}`,
              matches: sql`${huntProgress.matches} + 1`,
              wins: sql`${huntProgress.wins} + ${p.place === 1 && !p.dnf ? 1 : 0}`,
              updatedAt: new Date(),
            },
          })
          .returning({ xp: huntProgress.xp });
        const before = row.xp - xp;
        await tx.insert(huntResults).values({ matchId, userId: p.userId, score: p.score, place: p.place, xp, xpBefore: before });
        return { before, xp: row.xp, gained: xp };
      });
      const levelBefore = levelForXp(gain.before);
      const level = levelForXp(gain.xp);
      const had = new Set(tauntsAt(levelBefore));
      gains.push({
        userId: p.userId,
        gained: gain.gained,
        xp: gain.xp,
        levelBefore,
        level,
        levelXp: xpForLevel(level),
        nextLevelXp: xpForLevel(level + 1),
        unlocked: tauntsAt(level).filter((t) => !had.has(t)),
      });
    }
    return { players: gains };
  });
}
