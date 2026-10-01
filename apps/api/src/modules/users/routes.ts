import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ClaimBody, type MeView } from "@shadow/shared";
import type { Db } from "../../db/client";
import { profiles } from "../../db/schema";
import { GAME_TYPE, type ShadowGuessService } from "../shadow-guess/service";
import { getStats } from "../stats/service";

interface GoogleMetadata {
  full_name?: string;
  name?: string;
  avatar_url?: string;
  picture?: string;
}

function requireUser(req: FastifyRequest, reply: FastifyReply): string | null {
  if (!req.userId) void reply.code(401).send({ error: "sign_in_required" });
  return req.userId;
}

export function userRoutes(app: FastifyInstance, db: Db, shadowGuess: ShadowGuessService) {
  /** Current user's profile and stats. Also refreshes the profile from the Google account. */
  app.get("/api/me", async (req, reply): Promise<MeView | void> => {
    const userId = requireUser(req, reply);
    if (!userId) return;
    const meta = (req.authClaims?.user_metadata ?? {}) as GoogleMetadata;
    const displayName = meta.full_name ?? meta.name ?? null;
    const avatarUrl = meta.avatar_url ?? meta.picture ?? null;
    const [profile] = await db
      .insert(profiles)
      .values({ id: userId, displayName, avatarUrl })
      .onConflictDoUpdate({ target: profiles.id, set: { displayName, avatarUrl } })
      .returning();
    return {
      profile: { id: profile.id, displayName: profile.displayName, avatarUrl: profile.avatarUrl },
      stats: await getStats(db, userId, GAME_TYPE),
    };
  });

  app.post("/api/me/claim", async (req, reply) => {
    const userId = requireUser(req, reply);
    if (!userId) return;
    const { sessionIds } = ClaimBody.parse(req.body);
    return { claimed: await shadowGuess.claim(userId, sessionIds) };
  });
}
