import type { FastifyInstance } from "fastify";
import { LeaderboardQuery } from "@shadow/shared";
import type { Db } from "../../db/client";
import type { BumperService } from "../bumper-arena/service";
import type { PairPopService } from "../pair-pop/service";
import type { SkyClimbService } from "../sky-climb/service";
import { getLeaderboard } from "./service";

export function leaderboardRoutes(app: FastifyInstance, db: Db, skyClimb: SkyClimbService, pairPop: PairPopService, bumper: BumperService) {
  app.get("/api/leaderboard", async (req) => {
    const { game, period } = LeaderboardQuery.parse(req.query);
    if (game === "sky-climb") return skyClimb.leaderboard(period, req.userId);
    if (game === "pair-pop") return pairPop.leaderboard(period, req.userId);
    if (game === "bumper-arena") return bumper.leaderboard(period, req.userId);
    return getLeaderboard(db, game, period, req.userId);
  });
}
