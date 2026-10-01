import type { FastifyInstance } from "fastify";
import { LeaderboardQuery } from "@shadow/shared";
import type { Db } from "../../db/client";
import { getLeaderboard } from "./service";

export function leaderboardRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/leaderboard", async (req) => {
    const { game, period } = LeaderboardQuery.parse(req.query);
    return getLeaderboard(db, game, period, req.userId);
  });
}
