import type { ClimbRoom } from "./room";

export interface Env {
  CLIMB_ROOM: DurableObjectNamespace<ClimbRoom>;
  /** Limits room creation per IP (wrangler.jsonc `ratelimits`). */
  ROOM_CREATE_LIMIT?: RateLimit;
  /** Comma-separated web origins; `*` matches within one label. */
  ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_JWT_SECRET?: string;
}
