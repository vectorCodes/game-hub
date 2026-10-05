import type { FastifyInstance } from "fastify";
import { LeaderboardQuery } from "@shadow/shared";
import type { Db } from "../../db/client";
import type { SkyClimbService } from "../sky-climb/service";
import { getLeaderboard } from "./service";

export function leaderboardRoutes(app: FastifyInstance, db: Db, skyClimb: SkyClimbService) {
  app.get("/api/leaderboard", async (req) => {
    const { game, period } = LeaderboardQuery.parse(req.query);
    if (game === "sky-climb") return skyClimb.leaderboard(period, req.userId);
    return getLeaderboard(db, game, period, req.userId);
  });
}
