import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import type { Env } from "./env";

// Supabase access tokens, checked the same way as the API (apps/api/src/auth.ts): JWKS for
// current projects, the HS256 secret for legacy ones.

let jwks: { url: string; get: JWTVerifyGetKey } | null = null;

/** Whether signed-in players can be recognised; without it they join as guests. */
export const authConfigured = (env: Env) => Boolean(env.SUPABASE_URL || env.SUPABASE_JWT_SECRET);

/** The token's claims, or null if it isn't a valid Supabase token for this project. */
export async function verifyToken(token: string, env: Env): Promise<JWTPayload | null> {
  try {
    const { alg } = decodeProtectedHeader(token);
    const options = { audience: "authenticated" };
    if (alg?.startsWith("HS")) {
      if (!env.SUPABASE_JWT_SECRET) return null;
      return (await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET), options)).payload;
    }
    if (!env.SUPABASE_URL) return null;
    if (jwks?.url !== env.SUPABASE_URL) {
      jwks = { url: env.SUPABASE_URL, get: createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", env.SUPABASE_URL)) };
    }
    return (await jwtVerify(token, jwks.get, options)).payload;
  } catch {
    return null;
  }
}
