import type { FastifyInstance } from "fastify";
import { ClaimPuttBody, PuttHoleBody, StartPuttBody } from "@shadow/shared";
import { z } from "zod";
import type { PuttIslesService } from "./service";

const RoundParams = z.object({ id: z.uuid() });

export function puttIslesRoutes(app: FastifyInstance, service: PuttIslesService) {
  const prefix = "/api/putt-isles";

  app.post(`${prefix}/rounds`, async (req) => {
    const { mode, resume } = StartPuttBody.parse(req.body);
    return service.start(mode, req.userId, resume);
  });

  app.post(`${prefix}/rounds/:id/holes`, async (req) => {
    const { id } = RoundParams.parse(req.params);
    const { hole, strokes } = PuttHoleBody.parse(req.body);
    return service.hole(id, req.userId, hole, strokes);
  });

  app.get(`${prefix}/daily`, async (req) => service.daily(req.userId));

  app.post(`${prefix}/claim`, async (req, reply) => {
    if (!req.userId) return reply.code(401).send({ error: "sign_in_required" });
    return { claimed: await service.claim(req.userId, ClaimPuttBody.parse(req.body).roundIds) };
  });
}
