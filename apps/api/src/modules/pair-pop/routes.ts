import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ClaimPairPopBody, FinishPairPopBody, StartPairPopBody } from "@shadow/shared";
import { z } from "zod";
import type { PairPopService } from "./service";

const GameParams = z.object({ id: z.uuid() });

function requireUser(req: FastifyRequest, reply: FastifyReply): string | null {
  if (!req.userId) void reply.code(401).send({ error: "sign_in_required" });
  return req.userId;
}

export function pairPopRoutes(app: FastifyInstance, service: PairPopService) {
  const prefix = "/api/pair-pop";

  app.post(`${prefix}/games`, async (req) => service.start(StartPairPopBody.parse(req.body), req.userId));

  app.post(`${prefix}/games/:id/finish`, async (req) => {
    const { id } = GameParams.parse(req.params);
    return service.finish(id, req.userId, FinishPairPopBody.parse(req.body));
  });

  app.get(`${prefix}/daily`, async (req) => service.daily(req.userId));

  // Level stars across devices: signed-in players only (guests keep theirs in the browser).
  app.get(`${prefix}/progress`, async (req, reply) => {
    const userId = requireUser(req, reply);
    if (userId) return service.progress(userId);
  });

  app.post(`${prefix}/claim`, async (req, reply) => {
    const userId = requireUser(req, reply);
    if (userId) return { claimed: await service.claim(userId, ClaimPairPopBody.parse(req.body).gameIds) };
  });
}
