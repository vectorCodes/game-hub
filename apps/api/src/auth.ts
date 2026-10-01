import type { FastifyInstance } from "fastify";
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import type { Config } from "./config";

declare module "fastify" {
  interface FastifyRequest {
    /** Supabase auth user id, or null for guests (no token). */
    userId: string | null;
    /** Verified token claims (user_metadata carries the Google name and avatar). */
    authClaims: JWTPayload | null;
  }
}

/**
 * Verifies `Authorization: Bearer <Supabase access token>` when present. Requests without
 * a token proceed as guests; a present but invalid token is rejected.
 *
 * Current Supabase projects sign with asymmetric keys (ES256/RS256) published as JWKS at
 * SUPABASE_URL; legacy projects sign HS256 with SUPABASE_JWT_SECRET. The token's own
 * `alg` picks which one is used.
 */
export function registerAuth(app: FastifyInstance, config: Pick<Config, "supabaseUrl" | "supabaseJwtSecret">) {
  const secret = config.supabaseJwtSecret ? new TextEncoder().encode(config.supabaseJwtSecret) : null;
  const jwks: JWTVerifyGetKey | null = config.supabaseUrl
    ? createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", config.supabaseUrl))
    : null;

  if (config.supabaseJwtSecret?.startsWith("sb_")) {
    app.log.warn(
      "SUPABASE_JWT_SECRET looks like a Supabase API key (sb_...), not a JWT secret. " +
        "Leave it empty unless your project uses the legacy HS256 JWT secret.",
    );
  }

  app.decorateRequest("userId", null);
  app.decorateRequest("authClaims", null);
  app.addHook("onRequest", async (request, reply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    const token = header.slice("Bearer ".length);
    try {
      const { alg } = decodeProtectedHeader(token);
      const options = { audience: "authenticated" };
      let payload: JWTPayload;
      if (alg?.startsWith("HS")) {
        if (!secret) return reply.code(401).send({ error: "auth_not_configured" });
        ({ payload } = await jwtVerify(token, secret, options));
      } else {
        if (!jwks) return reply.code(401).send({ error: "auth_not_configured" });
        ({ payload } = await jwtVerify(token, jwks, options));
      }
      request.userId = payload.sub ?? null;
      request.authClaims = payload;
    } catch (error) {
      request.log.warn({ err: error }, "rejected bearer token");
      return reply.code(401).send({ error: "invalid_token" });
    }
  });
}
