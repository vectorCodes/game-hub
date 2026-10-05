import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { AvatarBody, avatarProblems, fixAvatar, type AvatarView } from "@shadow/shared";
import type { Db } from "../../db/client";
import { avatars } from "../../db/schema";
import type { SkyClimbService } from "../sky-climb/service";

function requireUser(req: FastifyRequest, reply: FastifyReply): string | null {
  if (!req.userId) void reply.code(401).send({ error: "sign_in_required" });
  return req.userId;
}

/**
 * The player's GameHub avatar. What they may wear comes from the shared item catalog:
 * free, bought with Sky Climb coins, or earned in either game.
 */
export function avatarRoutes(app: FastifyInstance, db: Db, skyClimb: SkyClimbService) {
  const view = async (userId: string): Promise<AvatarView> => {
    const profile = await skyClimb.profile(userId);
    const [row] = await db.select().from(avatars).where(eq(avatars.userId, userId));
    return {
      // Something no longer owned (an item removed from the catalog) quietly reverts.
      config: row ? fixAvatar(row.config, profile.owned) : null,
      owned: profile.owned,
      coins: profile.coins.balance,
    };
  };

  app.get("/api/avatar", async (req, reply) => {
    const userId = requireUser(req, reply);
    if (userId) return view(userId);
  });

  app.post("/api/avatar", async (req, reply) => {
    const userId = requireUser(req, reply);
    if (!userId) return;
    const { config } = AvatarBody.parse(req.body);
    const { owned } = await skyClimb.profile(userId);
    const problems = avatarProblems(config, owned);
    if (problems.length) return reply.code(422).send({ error: problems[0] });
    await db
      .insert(avatars)
      .values({ userId, config })
      .onConflictDoUpdate({ target: avatars.userId, set: { config, updatedAt: new Date() } });
    return view(userId);
  });
}
