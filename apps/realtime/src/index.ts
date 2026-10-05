// Sky Climb rooms: a small Worker in front of one ClimbRoom Durable Object per room code.
//   POST /rooms               → { code }               make a room
//   GET  /rooms/:code         → RoomPeek              before joining
//   GET  /rooms/:code/ws      → WebSocket             the room itself
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, normalizeRoomCode, type RoomPeek } from "@shadow/shared";
import type { Env } from "./env";

export { ClimbRoom } from "./room";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = origin !== null && originAllowed(origin, env.ALLOWED_ORIGINS);
    const cors: Record<string, string> = allowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        }
      : { Vary: "Origin" };

    if (request.method === "OPTIONS") return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (url.pathname === "/health") return json({ ok: true }, 200, cors);
    // Browsers always send Origin here; other sites' pages may not use the rooms.
    if (origin !== null && !allowed) return json({ error: "forbidden_origin" }, 403, cors);

    const match = url.pathname.match(/^\/rooms(?:\/([^/]+)(\/ws)?)?\/?$/);
    if (!match) return json({ error: "not_found" }, 404, cors);
    const [, rawCode, ws] = match;

    if (!rawCode) {
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
      const ip = request.headers.get("CF-Connecting-IP") ?? "local";
      const limit = await env.ROOM_CREATE_LIMIT?.limit({ key: ip });
      if (limit && !limit.success) return json({ error: "too_many_rooms" }, 429, cors);
      // A clash is rare (31^5 codes); try a few.
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        if (await roomStub(env, code).init(code)) return json({ code }, 201, cors);
      }
      return json({ error: "no_free_code" }, 503, cors);
    }

    const code = normalizeRoomCode(decodeURIComponent(rawCode));
    if (ws) {
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "expected_websocket" }, 426, cors);
      if (!code) return json({ error: "not_found" }, 404, cors);
      return roomStub(env, code).fetch(request);
    }
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, cors);
    const peek: RoomPeek = code ? await roomStub(env, code).peek() : { exists: false, players: 0, status: null };
    return json(peek, 200, cors);
  },
} satisfies ExportedHandler<Env>;

function roomStub(env: Env, code: string) {
  return env.CLIMB_ROOM.get(env.CLIMB_ROOM.idFromName(code));
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

/** `ALLOWED_ORIGINS` is comma-separated; `*` matches within one label (Vercel preview URLs). */
function originAllowed(origin: string, list = "") {
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((pattern) => {
      const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^.]*")}$`);
      return re.test(origin);
    });
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
