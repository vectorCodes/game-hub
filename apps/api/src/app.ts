import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { registerAuth } from "./auth";
import type { Config } from "./config";
import type { Db } from "./db/client";
import { devRoutes } from "./modules/dev/routes";
import { shadowGuessRoutes } from "./modules/shadow-guess/routes";
import { userRoutes } from "./modules/users/routes";
import { leaderboardRoutes } from "./modules/leaderboard/routes";
import { NotFoundError, ShadowGuessService } from "./modules/shadow-guess/service";
import { avatarRoutes } from "./modules/avatar/routes";
import { skyClimbRoutes } from "./modules/sky-climb/routes";
import { SkyClimbService, TooFastError } from "./modules/sky-climb/service";
import { puttIslesRoutes } from "./modules/putt-isles/routes";
import { PuttIslesService } from "./modules/putt-isles/service";
import { MODELS_DIR } from "./paths";

type AppConfig = Pick<
  Config,
  "corsOrigin" | "modelsBaseUrl" | "serveModels" | "isProd" | "supabaseUrl" | "supabaseJwtSecret"
>;

export async function buildApp(db: Db, config: AppConfig, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(cors, { origin: config.corsOrigin });
  registerAuth(app, config);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "invalid_request", issues: error.issues });
    }
    if (error instanceof NotFoundError) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (error instanceof TooFastError) {
      return reply.code(422).send({ error: "too_fast" });
    }
    request.log.error(error);
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status).send({ error: status === 500 ? "internal_error" : (error as Error).message });
  });

  if (config.serveModels) {
    await app.register(fastifyStatic, {
      root: MODELS_DIR,
      prefix: "/models/",
      // Keys are content hashes, so a URL's bytes never change.
      immutable: true,
      maxAge: "365d",
      allowedPath: (path) => path.endsWith(".glb"),
    });
  }

  app.get("/api/health", async () => ({ ok: true }));
  const shadowGuess = new ShadowGuessService(db, config.modelsBaseUrl);
  shadowGuessRoutes(app, shadowGuess);
  userRoutes(app, db, shadowGuess);
  const skyClimb = new SkyClimbService(db);
  const puttIsles = new PuttIslesService(db);
  leaderboardRoutes(app, db, skyClimb, puttIsles);
  skyClimbRoutes(app, skyClimb);
  puttIslesRoutes(app, puttIsles);
  avatarRoutes(app, db, skyClimb);
  if (!config.isProd) devRoutes(app, db, config.modelsBaseUrl);

  return { app, shadowGuess };
}
