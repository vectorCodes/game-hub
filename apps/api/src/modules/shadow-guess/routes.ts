import type { FastifyInstance } from "fastify";
import { AlbumBody, GuessBody, SessionParams, StartSessionBody } from "@shadow/shared";
import { z } from "zod";
import type { ShadowGuessService } from "./service";

export function shadowGuessRoutes(app: FastifyInstance, service: ShadowGuessService) {
  const prefix = "/api/shadow-guess";

  app.post(`${prefix}/sessions`, async (req) => {
    const { mode, previousSessionId } = StartSessionBody.parse(req.body);
    return service.startSession(mode, req.userId, previousSessionId);
  });

  app.get(`${prefix}/sessions/:id`, async (req) => {
    const { id } = SessionParams.parse(req.params);
    return service.getSession(id, req.userId);
  });

  app.post(`${prefix}/sessions/:id/guess`, async (req) => {
    const { id } = SessionParams.parse(req.params);
    const { text } = GuessBody.parse(req.body);
    return service.guess(id, req.userId, text);
  });

  app.post(`${prefix}/sessions/:id/skip`, async (req) => {
    const { id } = SessionParams.parse(req.params);
    return service.skip(id, req.userId);
  });

  app.post(`${prefix}/sessions/:id/hint`, async (req) => {
    const { id } = SessionParams.parse(req.params);
    return service.hint(id, req.userId);
  });

  app.post(`${prefix}/album`, async (req) => {
    const { sessionIds } = AlbumBody.parse(req.body ?? {});
    return service.album(req.userId, sessionIds);
  });

  app.get(`${prefix}/objects/names`, async () => service.listNames());

  app.get(`${prefix}/daily`, async (req) => {
    const { sessionId } = z.object({ sessionId: z.uuid().optional() }).parse(req.query);
    return service.dailyInfo(req.userId, sessionId);
  });
}
