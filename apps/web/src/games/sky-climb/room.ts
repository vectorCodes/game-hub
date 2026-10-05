// Rooms: 1–3 friends racing the same tower, over a WebSocket to the room server
// (apps/realtime, a Cloudflare Durable Object per room). The server decides who's in, when
// the race starts and who won; this keeps its latest word for the UI. See Multiplayer.md.
import { useSyncExternalStore } from "react";
import {
  ROOM_POS_HZ,
  ROOM_PROTOCOL_VERSION,
  type AvatarConfig,
  type GhostFrame,
  type RoomClientMessage,
  type RoomErrorCode,
  type RoomPeek,
  type RoomServerMessage,
  type RoomStanding,
  type RoomView,
} from "@shadow/shared";
import { supabase } from "../../lib/supabase";
import { packFrame, pushPacked, sampleLive, type LiveRider } from "./live";

/** The room server; `pnpm dev` runs one on :3300. */
const REALTIME_URL: string = import.meta.env.VITE_REALTIME_URL || (import.meta.env.DEV ? "http://localhost:3300" : "");

export const roomsAvailable = REALTIME_URL !== "";

export type RoomError = RoomErrorCode | "network" | "replaced" | "create_failed";

export interface RoomState {
  /** The room joined, or being joined. */
  code: string | null;
  connection: "idle" | "connecting" | "open" | "reconnecting";
  /** This player's id in the room. */
  you: string | null;
  room: RoomView | null;
  standings: RoomStanding[] | null;
  /** Why the last join failed, or why we were put out. */
  error: RoomError | null;
}

interface Who {
  name: string;
  avatar: AvatarConfig | null;
}

const IDLE: RoomState = { code: null, connection: "idle", you: null, room: null, standings: null, error: null };
let state: RoomState = IDLE;
const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let who: Who = { name: "Guest", avatar: null };
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

/** Give up reconnecting after this long: the server frees the slot about then anyway. */
const RECONNECT_FOR_MS = 15_000;
/** When the connection to a joined room dropped. */
let downSince: number | null = null;

function update(next: Partial<RoomState>) {
  state = { ...state, ...next };
  syncRivals(state.room, state.you);
  for (const l of listeners) l();
}

export function useRoom(): RoomState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => state,
  );
}

export const roomState = () => state;

/**
 * This tab's id: a reload gets the same slot back, while another tab (a friend testing on one
 * computer) is another player. Signed-in players are known by their account instead.
 */
function clientId(): string {
  const key = "sky-climb:room-client";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) sessionStorage.setItem(key, (id = crypto.randomUUID()));
    return id;
  } catch {
    return (memoryId ??= crypto.randomUUID());
  }
}
let memoryId: string | undefined;

const httpUrl = (path: string) => `${REALTIME_URL}${path}`;
const wsUrl = (path: string) => httpUrl(path).replace(/^http/, "ws");

/** Makes a room; resolves to its code, or null if the server couldn't. */
export async function createRoom(): Promise<string | null> {
  try {
    const res = await fetch(httpUrl("/rooms"), { method: "POST" });
    if (!res.ok) return null;
    return ((await res.json()) as { code: string }).code;
  } catch {
    return null;
  }
}

export async function peekRoom(code: string): Promise<RoomPeek | null> {
  try {
    const res = await fetch(httpUrl(`/rooms/${code}`));
    return res.ok ? ((await res.json()) as RoomPeek) : null;
  } catch {
    return null;
  }
}

export function joinRoom(code: string, as: Who) {
  if (state.code === code && state.connection !== "idle") return;
  closeSocket();
  who = as;
  retries = 0;
  downSince = null;
  update({ ...IDLE, code, connection: "connecting" });
  connect(code);
}

export function leaveRoom() {
  if (socket?.readyState === WebSocket.OPEN) send({ type: "leave" });
  closeSocket();
  update(IDLE);
}

export const clearRoomError = () => update({ error: null });

export const setReady = (on: boolean) => send({ type: "ready", on });
export const startRace = () => send({ type: "start" });
export const rematch = () => send({ type: "rematch" });
export const sendRoomProgress = (floor: number) => send({ type: "progress", floor });
export const sendRoomFinish = () => send({ type: "finish" });
export const sendRoomPos = (f: GhostFrame) => send({ type: "pos", p: packFrame(f) });
/** Seconds between position sends. */
export const ROOM_SEND_EVERY = 1 / ROOM_POS_HZ;

// ---------- The server's clock ----------

/** Server time minus this browser's, from the quickest ping. Race times are server times. */
let clockOffset = 0;
let bestRtt = Infinity;

/** A server time (the race's start or end) on this browser's clock. */
export const toLocalTime = (serverMs: number) => serverMs - clockOffset;

function syncClock() {
  bestRtt = Infinity;
  for (let i = 0; i < 5; i++) setTimeout(() => send({ type: "ping", t: Date.now() }), i * 150);
}

// ---------- The other racers ----------

/** Drawn this far behind, so there are two positions (sent 10 a second) to blend. */
const RIVAL_DELAY_MS = 220;
const rivals = new Map<string, LiveRider>();
let rivalList: LiveRider[] = [];

/** The other players in the room, with their latest positions. */
export function useRoomRivals(): LiveRider[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => rivalList,
  );
}

export const sampleRival = (rival: LiveRider, out: GhostFrame) => sampleLive(rival, out, RIVAL_DELAY_MS);

/** Keeps a rider per other player, named and dressed as the room says. */
function syncRivals(room: RoomView | null, you: string | null) {
  const present = new Set(room?.players.filter((p) => p.id !== you && !p.dnf).map((p) => p.id));
  let changed = false;
  for (const id of rivals.keys()) {
    if (!present.has(id)) {
      rivals.delete(id);
      changed = true;
    }
  }
  for (const p of room?.players ?? []) {
    if (!present.has(p.id)) continue;
    const rival = rivals.get(p.id);
    if (!rival) {
      rivals.set(p.id, { id: p.id, name: p.name, avatar: p.avatar, buffer: [] });
      changed = true;
    } else if (rival.name !== p.name || rival.avatar !== p.avatar) {
      Object.assign(rival, { name: p.name, avatar: p.avatar });
      changed = true;
    }
  }
  if (changed) rivalList = [...rivals.values()];
}

function send(msg: RoomClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function closeSocket() {
  clearTimeout(retryTimer);
  if (!socket) return;
  const s = socket;
  socket = null;
  s.onclose = s.onmessage = s.onopen = s.onerror = null;
  s.close(1000);
}

function connect(code: string) {
  const ws = new WebSocket(wsUrl(`/rooms/${code}/ws`));
  socket = ws;
  // Set by the server's error message just before it closes the socket on us.
  let refused: RoomError | null = null;

  ws.onopen = async () => {
    const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
    if (socket !== ws) return;
    send({ type: "hello", v: ROOM_PROTOCOL_VERSION, token, clientId: clientId(), name: who.name, avatar: who.avatar });
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data as string) as RoomServerMessage;
    switch (msg.type) {
      case "welcome":
        retries = 0;
        downSince = null;
        syncClock();
        update({ connection: "open", you: msg.you, room: msg.room, error: null, standings: msg.room.status === "results" ? state.standings : null });
        break;
      case "room":
        update({ room: msg.room, standings: msg.room.status === "results" ? state.standings : null });
        break;
      case "results":
        update({ standings: msg.standings });
        break;
      case "pos": {
        const rival = rivals.get(msg.id);
        if (rival) pushPacked(rival, msg.p);
        break;
      }
      case "pong": {
        const now = Date.now();
        const rtt = now - msg.t;
        if (rtt < bestRtt) {
          bestRtt = rtt;
          clockOffset = msg.now + rtt / 2 - now;
        }
        break;
      }
      case "error":
        // Errors about a message we sent (not_host, not_ready…) don't end the room.
        if (state.connection !== "open" || msg.code === "not_found" || msg.code === "outdated") refused = msg.code;
        break;
    }
  };

  ws.onclose = (e) => {
    if (socket !== ws) return;
    socket = null;
    if (refused || e.code === 4001 || e.code === 4004) {
      update({ ...IDLE, error: refused ?? (e.code === 4001 ? "replaced" : "not_found") });
      return;
    }
    // Never got in: the server can't be reached.
    if (!state.room) {
      update({ ...IDLE, error: "network" });
      return;
    }
    // Dropped: keep the room on screen and try to get the slot back.
    downSince ??= Date.now();
    if (Date.now() - downSince > RECONNECT_FOR_MS) {
      update({ ...IDLE, error: "network" });
      return;
    }
    update({ connection: "reconnecting" });
    retryTimer = setTimeout(() => connect(code), Math.min(4000, 500 * 2 ** retries++));
  };
}
