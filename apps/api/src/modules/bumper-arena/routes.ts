import type { FastifyInstance } from "fastify";
import { ClaimBumperBody, FinishBumperRunBody } from "@shadow/shared";
import { z } from "zod";
import type { BumperService } from "./service";

const RunParams = z.object({ id: z.uuid() });

export function bumperRoutes(app: FastifyInstance, service: BumperService) {
  const prefix = "/api/bumper-arena";

  app.post(`${prefix}/runs`, async (req) => service.start(req.userId));

  app.post(`${prefix}/runs/:id/finish`, async (req) => {
    const { id } = RunParams.parse(req.params);
    return service.finish(id, req.userId, FinishBumperRunBody.parse(req.body));
  });

  app.get(`${prefix}/daily`, async (req) => service.daily(req.userId));

  app.post(`${prefix}/claim`, async (req, reply) => {
    if (!req.userId) return reply.code(401).send({ error: "sign_in_required" });
    return { claimed: await service.claim(req.userId, ClaimBumperBody.parse(req.body).runIds) };
  });
}
