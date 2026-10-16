// A room on the room server (apps/realtime, a Cloudflare Durable Object per room), from the
// browser's side: create, peek, join, reconnect, sync the clock, and keep the server's latest
// word for React. Each game makes one client with its own path and adds its own messages on
// top; the server decides everything, and this only shows what it says. See Multiplayer.md.
import { useSyncExternalStore } from "react";
import type { AvatarConfig, CoreClientMessage, CoreServerMessage, RoomErrorCode, RoomPeekOf } from "@shadow/shared";
import { supabase } from "./supabase";

/** The room server; `pnpm dev` runs one on :3300. */
const REALTIME_URL: string = import.meta.env.VITE_REALTIME_URL || (import.meta.env.DEV ? "http://localhost:3300" : "");

export const roomsAvailable = REALTIME_URL !== "";

export type RoomError = RoomErrorCode | "network" | "replaced" | "create_failed";

/** The core of a room's state; a game adds its own fields (`X`). */
export interface CoreRoomState<V> {
  /** The room joined, or being joined. */
  code: string | null;
  connection: "idle" | "connecting" | "open" | "reconnecting";
  /** This player's id in the room. */
  you: string | null;
  room: V | null;
  /** Why the last join failed, or why we were put out. */
  error: RoomError | null;
}

export interface Who {
  name: string;
  avatar: AvatarConfig | null;
}

/** Give up reconnecting after this long: the server frees the slot about then anyway. */
const RECONNECT_FOR_MS = 15_000;

interface Options<V, X, M> {
  /** Where this game's rooms live on the server ("/rooms", "/hunt/rooms"). */
  path: string;
  protocolVersion: number;
  /** sessionStorage key for this tab's id. */
  clientKey: string;
  /** The game's own state fields, as they start (and are reset to on leaving). */
  extra: X;
  /** Every message, after the core has applied welcome, room, pong and error. */
  onMessage?: (msg: M, room: RoomClient<V, X, M>) => void;
  /** After every state change (to keep derived things, like rivals, in step). */
  onUpdate?: (state: CoreRoomState<V> & X) => void;
}

export interface RoomClient<V, X, M> {
  useRoom(): CoreRoomState<V> & X;
  state(): CoreRoomState<V> & X;
  update(next: Partial<CoreRoomState<V> & X>): void;
  /** Called on every change: for hooks over things a game keeps beside `state` (rivals, say). */
  subscribe(listener: () => void): () => void;
  create(): Promise<string | null>;
  peek(code: string): Promise<RoomPeekOf<string> | null>;
  join(code: string, as: Who): void;
  leave(): void;
  clearError(): void;
  send(msg: { type: string } & Record<string, unknown>): void;
  /** A server time on this browser's clock. */
  toLocalTime(serverMs: number): number;
}

export function createRoomClient<V extends object, X extends object, M extends { type: string }>(opts: Options<V, X, M>): RoomClient<V, X, M> {
  type State = CoreRoomState<V> & X;
  const IDLE: State = { code: null, connection: "idle", you: null, room: null, error: null, ...opts.extra };
  let state: State = IDLE;
  const listeners = new Set<() => void>();
  let socket: WebSocket | null = null;
  let who: Who = { name: "Guest", avatar: null };
  let retries = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  /** When the connection to a joined room dropped. */
  let downSince: number | null = null;
  /** Server time minus this browser's, from the quickest ping. */
  let clockOffset = 0;
  let bestRtt = Infinity;
  let memoryId: string | undefined;

  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  };

  function update(next: Partial<State>) {
    state = { ...state, ...next };
    opts.onUpdate?.(state);
    for (const l of listeners) l();
  }

  /**
   * This tab's id: a reload gets the same slot back, while another tab (a friend testing on
   * one computer) is another player. Signed-in players are known by their account instead.
   */
  function clientId(): string {
    try {
      let id = sessionStorage.getItem(opts.clientKey);
      if (!id) sessionStorage.setItem(opts.clientKey, (id = crypto.randomUUID()));
      return id;
    } catch {
      return (memoryId ??= crypto.randomUUID());
    }
  }

  const httpUrl = (path: string) => `${REALTIME_URL}${opts.path}${path}`;
  const wsUrl = (path: string) => httpUrl(path).replace(/^http/, "ws");

  function send(msg: { type: string } & Record<string, unknown>) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }

  function syncClock() {
    bestRtt = Infinity;
    for (let i = 0; i < 5; i++) setTimeout(() => send({ type: "ping", t: Date.now() } satisfies CoreClientMessage), i * 150);
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
    const ws = new WebSocket(wsUrl(`/${code}/ws`));
    socket = ws;
    // Set by the server's error message just before it closes the socket on us.
    let refused: RoomError | null = null;

    ws.onopen = async () => {
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
      if (socket !== ws) return;
      send({ type: "hello", v: opts.protocolVersion, token, clientId: clientId(), name: who.name, avatar: who.avatar } satisfies CoreClientMessage);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as M | CoreServerMessage<V>;
      switch (msg.type) {
        case "welcome": {
          const m = msg as Extract<CoreServerMessage<V>, { type: "welcome" }>;
          retries = 0;
          downSince = null;
          syncClock();
          update({ connection: "open", you: m.you, room: m.room, error: null } as Partial<State>);
          break;
        }
        case "room":
          update({ room: (msg as Extract<CoreServerMessage<V>, { type: "room" }>).room } as Partial<State>);
          break;
        case "pong": {
          const m = msg as Extract<CoreServerMessage<V>, { type: "pong" }>;
          const now = Date.now();
          const rtt = now - m.t;
          if (rtt < bestRtt) {
            bestRtt = rtt;
            clockOffset = m.now + rtt / 2 - now;
          }
          break;
        }
        case "error": {
          const code = (msg as Extract<CoreServerMessage<V>, { type: "error" }>).code;
          // Errors about a message we sent (not_host, not_ready…) don't end the room.
          if (state.connection !== "open" || code === "not_found" || code === "outdated") refused = code;
          break;
        }
      }
      opts.onMessage?.(msg as M, client);
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
      update({ connection: "reconnecting" } as Partial<State>);
      retryTimer = setTimeout(() => connect(code), Math.min(4000, 500 * 2 ** retries++));
    };
  }

  const client: RoomClient<V, X, M> = {
    useRoom: () => useSyncExternalStore(subscribe, () => state),
    state: () => state,
    update,
    subscribe,
    async create() {
      try {
        const res = await fetch(httpUrl(""), { method: "POST" });
        if (!res.ok) return null;
        return ((await res.json()) as { code: string }).code;
      } catch {
        return null;
      }
    },
    async peek(code) {
      try {
        const res = await fetch(httpUrl(`/${code}`));
        return res.ok ? ((await res.json()) as RoomPeekOf<string>) : null;
      } catch {
        return null;
      }
    },
    join(code, as) {
      if (state.code === code && state.connection !== "idle") return;
      closeSocket();
      who = as;
      retries = 0;
      downSince = null;
      update({ ...IDLE, code, connection: "connecting" } as Partial<State>);
      connect(code);
    },
    leave() {
      if (socket?.readyState === WebSocket.OPEN) send({ type: "leave" } satisfies CoreClientMessage);
      closeSocket();
      update(IDLE);
    },
    clearError: () => update({ error: null } as Partial<State>),
    send,
    toLocalTime: (serverMs) => serverMs - clockOffset,
  };
  return client;
}
