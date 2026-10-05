import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BuyItemBody, ClaimClimbsBody, ClimbFinishBody, ClimbProgressBody, LoadoutBody, StartClimbBody } from "@shadow/shared";
import { z } from "zod";
import type { SkyClimbService } from "./service";

const RunParams = z.object({ id: z.uuid() });
const GhostsQuery = z.object({ seed: z.string().min(1).max(100) });

function requireUser(req: FastifyRequest, reply: FastifyReply): string | null {
  if (!req.userId) void reply.code(401).send({ error: "sign_in_required" });
  return req.userId;
}

export function skyClimbRoutes(app: FastifyInstance, service: SkyClimbService) {
  const prefix = "/api/sky-climb";

  app.post(`${prefix}/runs`, async (req) => {
    const { mode, challenge } = StartClimbBody.parse(req.body);
    return service.start(mode, req.userId, challenge);
  });

  app.post(`${prefix}/runs/:id/progress`, async (req) => {
    const { id } = RunParams.parse(req.params);
    return service.progress(id, req.userId, ClimbProgressBody.parse(req.body));
  });

  app.post(`${prefix}/runs/:id/finish`, async (req) => {
    const { id } = RunParams.parse(req.params);
    return service.progress(id, req.userId, ClimbFinishBody.parse(req.body), true);
  });

  // Ghosts to race on a tower, and challenge links ("beat my climb").
  app.get(`${prefix}/ghosts`, async (req) => service.ghosts(GhostsQuery.parse(req.query).seed, req.userId));

  app.get(`${prefix}/challenge/:id`, async (req) => service.challenge(RunParams.parse(req.params).id, req.userId));

  app.get(`${prefix}/daily`, async (req) => service.daily(req.userId));

  // The locker: signed-in players only (guests keep their coins and achievements in the browser).
  app.get(`${prefix}/profile`, async (req, reply) => {
    const userId = requireUser(req, reply);
    if (userId) return service.profile(userId);
  });

  app.post(`${prefix}/buy`, async (req, reply) => {
    const userId = requireUser(req, reply);
    if (userId) return service.buy(userId, BuyItemBody.parse(req.body).item);
  });

  app.post(`${prefix}/loadout`, async (req, reply) => {
    const userId = requireUser(req, reply);
    if (userId) return service.equip(userId, LoadoutBody.parse(req.body));
  });

  app.post(`${prefix}/claim`, async (req, reply) => {
    const userId = requireUser(req, reply);
    if (userId) return { claimed: await service.claim(userId, ClaimClimbsBody.parse(req.body).runIds) };
  });
}
