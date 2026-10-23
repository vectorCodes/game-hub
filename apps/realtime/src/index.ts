// Game rooms: a small Worker in front of one Durable Object per room code. Each game has its
// own path prefix and Durable Object class, so codes never clash between games.
//   POST <prefix>               → { code }               make a room
//   GET  <prefix>/:code         → RoomPeek               before joining
//   GET  <prefix>/:code/ws      → WebSocket              the room itself
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, normalizeRoomCode, type RoomPeekOf } from "@shadow/shared";
import type { Env } from "./env";

export { ClimbRoom } from "./room";
export { HuntRoom } from "./huntRoom";
export { BumperRoom } from "./bumperRoom";

/** What the Worker asks of any game's room (RoomCore provides all three). */
interface RoomStub {
  init(code: string): Promise<boolean>;
  peek(): Promise<RoomPeekOf<string>>;
  fetch(request: Request): Promise<Response>;
}

/** Each game's rooms, by path prefix. */
const GAMES: { prefix: string; room: (env: Env, code: string) => RoomStub }[] = [
  // Sky Climb came first, so its rooms are at the bare /rooms.
  { prefix: "/rooms", room: (env, code) => env.CLIMB_ROOM.get(env.CLIMB_ROOM.idFromName(code)) },
  { prefix: "/hunt/rooms", room: (env, code) => env.HUNT_ROOM.get(env.HUNT_ROOM.idFromName(code)) },
  { prefix: "/bumper/rooms", room: (env, code) => env.BUMPER_ROOM.get(env.BUMPER_ROOM.idFromName(code)) },
];

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

    for (const game of GAMES) {
      if (url.pathname !== game.prefix && !url.pathname.startsWith(`${game.prefix}/`)) continue;
      const match = url.pathname.slice(game.prefix.length).match(/^(?:\/([^/]+)(\/ws)?)?\/?$/);
      if (!match) continue;
      return rooms(request, env, cors, game.room, match[1], Boolean(match[2]));
    }
    return json({ error: "not_found" }, 404, cors);
  },
} satisfies ExportedHandler<Env>;

async function rooms(request: Request, env: Env, cors: Record<string, string>, room: (env: Env, code: string) => RoomStub, rawCode: string | undefined, ws: boolean) {
  if (!rawCode) {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    const ip = request.headers.get("CF-Connecting-IP") ?? "local";
    const limit = await env.ROOM_CREATE_LIMIT?.limit({ key: ip });
    if (limit && !limit.success) return json({ error: "too_many_rooms" }, 429, cors);
    // A clash is rare (31^5 codes); try a few.
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      if (await room(env, code).init(code)) return json({ code }, 201, cors);
    }
    return json({ error: "no_free_code" }, 503, cors);
  }

  const code = normalizeRoomCode(decodeURIComponent(rawCode));
  if (ws) {
    if (request.headers.get("Upgrade") !== "websocket") return json({ error: "expected_websocket" }, 426, cors);
    if (!code) return json({ error: "not_found" }, 404, cors);
    return room(env, code).fetch(request);
  }
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, cors);
  const peek: RoomPeekOf<string> = code ? await room(env, code).peek() : { exists: false, players: 0, status: null };
  return json(peek, 200, cors);
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

/**
 * `ALLOWED_ORIGINS` is comma-separated; `*` matches within one label (Vercel preview URLs).
 * Forgiving of how it was pasted: quotes, spaces, a trailing slash or a path, any case.
 */
function originAllowed(origin: string, list = "") {
  return list
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, "").replace(/(\/\/[^/]+)\/.*$/, "$1").toLowerCase())
    .filter(Boolean)
    .some((pattern) => {
      const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^.]*")}$`);
      return re.test(origin.toLowerCase());
    });
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
