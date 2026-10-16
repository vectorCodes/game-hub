// What every game's room does the same way: one Durable Object per room code, holding the
// lobby's players over WebSockets. It handles joining (with sign-in), reconnecting within the
// grace period, the host, leaving, the flood guard, idle clean-up, the alarm and saving. A game
// (ClimbRoom, HuntRoom…) adds its rules on top: its messages, its timers, and its view of the room.
//
// Uses the WebSocket Hibernation API, so an idle lobby costs nothing; everything that must
// survive hibernation is saved to storage after each change.
import { DurableObject } from "cloudflare:workers";
import { ROOM_GRACE_MS, shortName, type AvatarConfig, type CoreClientMessage, type CoreServerMessage, type RoomErrorCode, type RoomPeekOf } from "@shadow/shared";
import { authConfigured, verifyToken } from "./auth";
import type { Env } from "./env";

/** Nobody connected for this long: the room is deleted and its code freed. */
const IDLE_MS = 30 * 60_000;
const MAX_MESSAGE_CHARS = 8192;
/** Per socket; positions come at 10 a second, so this leaves room for the rest. */
const MAX_MESSAGES_PER_SECOND = 20;

export interface CorePlayer {
  id: string;
  /** Who gets this slot back on reconnecting: "u:<userId>" or "g:<clientId>". Never sent out. */
  key: string;
  name: string;
  avatar: AvatarConfig | null;
  ready: boolean;
  connected: boolean;
  /** When the connection dropped; the slot is held for ROOM_GRACE_MS. */
  droppedAt: number | null;
  /** Left while a game was on: no longer seated, but still in its results. */
  dnf: boolean;
}

export interface CoreRoom<P extends CorePlayer, S extends string> {
  code: string;
  status: S;
  hostId: string | null;
  /** In join order: the earliest one still here hosts. */
  players: P[];
  /** When the last player disconnected (or the room was made), while nobody is connected. */
  emptySince: number | null;
}

/** Kept on each socket, so it survives hibernation. */
interface Attachment {
  pid: string | null;
}

type Hello = Extract<CoreClientMessage, { type: "hello" }>;

/**
 * P: the game's player, R: its room, S: its statuses, C: its client messages (the core ones
 * included), V: its view of the room, M: its server messages (the core ones included).
 */
export abstract class RoomCore<
  P extends CorePlayer,
  S extends string,
  R extends CoreRoom<P, S>,
  C extends { type: string },
  V,
  M extends { type: string },
> extends DurableObject<Env> {
  protected room: R | null = null;
  private rates = new Map<WebSocket, { second: number; count: number }>();

  // ---------- What a game supplies ----------

  protected abstract readonly maxPlayers: number;
  protected abstract readonly protocolVersion: number;
  /** A fresh room in its lobby. */
  protected abstract newRoom(code: string): R;
  /** A new player, with the game's own fields at their starting values. */
  protected abstract newPlayer(core: CorePlayer): P;
  /** Parses (and validates) one message from a client; throws if it isn't one. */
  protected abstract parse(data: unknown): C;
  /** While true, nobody new may join and leaving makes you a DNF. */
  protected abstract playing(): boolean;
  /** The room as clients see it. */
  protected abstract view(): V;
  /** Any message other than hello, ping and leave, from a seated player. */
  protected abstract handle(ws: WebSocket, me: P, msg: C, now: number): void | Promise<void>;
  /** Moves the game along to `now` (start, end…); run on every message and alarm. */
  protected abstract advance(now: number): void;
  /** Times (ms) the game needs an alarm at, besides the core's own. */
  protected abstract due(): number[];
  /** A player left mid-game (or their slot ran out): anything the game must mark. */
  protected abandon(_p: P): void {}
  /** Sent to a socket right after its welcome (results already decided, say). */
  protected afterWelcome(_ws: WebSocket, _me: P): void {}

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<R>("room")) ?? null;
    });
  }

  /** Opens the room under `code`; false if that code is already taken. */
  async init(code: string): Promise<boolean> {
    if (this.room) return false;
    this.room = this.newRoom(code);
    await this.commit();
    return true;
  }

  async peek(): Promise<RoomPeekOf<S>> {
    if (!this.room) return { exists: false, players: 0, status: null };
    return { exists: true, players: this.seated().length, status: this.room.status };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    if (typeof data !== "string" || data.length > MAX_MESSAGE_CHARS) return this.send(ws, { type: "error", code: "bad_message" });
    if (!this.allow(ws)) return;
    let parsed: C;
    try {
      parsed = this.parse(JSON.parse(data));
    } catch {
      return this.send(ws, { type: "error", code: "bad_message" });
    }
    // A game's messages include the core ones (hello, ping, leave), handled here.
    const msg = parsed as C | CoreClientMessage;
    const now = Date.now();
    if (msg.type === "ping") return this.send(ws, { type: "pong", t: (msg as Extract<CoreClientMessage, { type: "ping" }>).t, now });

    const room = this.room;
    if (!room) return this.refuse(ws, "not_found");
    if (msg.type === "hello") return this.hello(ws, msg as Hello);

    const me = room.players.find((p) => p.id === pidOf(ws));
    if (!me) return this.send(ws, { type: "error", code: "bad_message" });

    if (msg.type === "leave") {
      ws.serializeAttachment({ pid: null } satisfies Attachment);
      this.remove(me);
      this.tick(now);
      this.close(ws, 1000, "left");
      this.broadcastRoom();
      await this.commit();
      return;
    }
    await this.handle(ws, me, msg as C, now);
  }

  async webSocketClose(ws: WebSocket) {
    this.rates.delete(ws);
    await this.dropped(ws);
    this.close(ws, 1000, "bye");
  }

  async webSocketError(ws: WebSocket) {
    this.rates.delete(ws);
    await this.dropped(ws);
  }

  async alarm() {
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    if (room.emptySince !== null && now - room.emptySince >= IDLE_MS && !room.players.some((p) => p.connected)) {
      for (const ws of this.ctx.getWebSockets()) this.close(ws, 4004, "expired");
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    this.tick(now);
    this.broadcastRoom();
    await this.commit();
  }

  // ---------- Joining and leaving ----------

  private async hello(ws: WebSocket, msg: Hello) {
    if (pidOf(ws)) return this.send(ws, { type: "error", code: "bad_message" });
    if (msg.v !== this.protocolVersion) return this.refuse(ws, "outdated");

    let key = `g:${msg.clientId}`;
    let name = cleanName(msg.name) || "Guest";
    // Without sign-in configured here (SUPABASE_URL), everyone plays as a guest.
    if (msg.token && authConfigured(this.env)) {
      const claims = await verifyToken(msg.token, this.env);
      if (!claims?.sub) return this.refuse(ws, "bad_token");
      key = `u:${claims.sub}`;
      const fullName = (claims.user_metadata as { full_name?: unknown } | undefined)?.full_name;
      if (typeof fullName === "string" && fullName.trim()) name = shortName(fullName);
    }

    // Checked after the token: other messages may have changed the room meanwhile.
    const room = this.room;
    if (!room) return this.refuse(ws, "not_found");
    const now = Date.now();
    this.tick(now);
    let me = room.players.find((p) => p.key === key);
    const playing = this.playing();
    if (me?.dnf && playing) return this.refuse(ws, "started");
    if (me) {
      // Back (or in a new tab): this socket takes the slot over.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && pidOf(other) === me.id) {
          other.serializeAttachment({ pid: null } satisfies Attachment);
          this.close(other, 4001, "replaced");
        }
      }
    } else {
      if (playing) return this.refuse(ws, "started");
      if (this.seated().length >= this.maxPlayers) return this.refuse(ws, "full");
      me = this.newPlayer({ id: randomId(), key, name, avatar: null, ready: false, connected: true, droppedAt: null, dnf: false });
      room.players.push(me);
    }
    Object.assign(me, { name, avatar: msg.avatar, connected: true, droppedAt: null });
    room.emptySince = null;
    this.fixHost();
    ws.serializeAttachment({ pid: me.id } satisfies Attachment);

    this.send(ws, { type: "welcome", you: me.id, room: this.view() });
    this.afterWelcome(ws, me);
    this.broadcastRoom(me.id);
    await this.commit();
  }

  /** A connection closed: the slot is held for ROOM_GRACE_MS in case they come back. */
  private async dropped(ws: WebSocket) {
    const room = this.room;
    const pid = pidOf(ws);
    if (!room || !pid) return;
    ws.serializeAttachment({ pid: null } satisfies Attachment);
    const me = room.players.find((p) => p.id === pid);
    // Still connected in another tab: nothing changed.
    if (!me || this.ctx.getWebSockets().some((o) => o !== ws && pidOf(o) === pid)) return;
    const now = Date.now();
    Object.assign(me, { connected: false, droppedAt: now });
    if (!room.players.some((p) => p.connected)) room.emptySince = now;
    this.broadcastRoom();
    await this.commit();
  }

  /** Gone for good: out of the lobby, or a DNF if a game is on (they keep their place in it). */
  protected remove(p: P) {
    const room = this.room!;
    if (this.playing()) {
      Object.assign(p, { dnf: true, connected: false });
      this.abandon(p);
    } else {
      room.players = room.players.filter((x) => x !== p);
    }
    if (!room.players.some((x) => x.connected)) room.emptySince ??= Date.now();
    this.fixHost();
  }

  // ---------- Time ----------

  /** Applies everything that's due by `now`: held slots running out, then the game's own timers. */
  protected tick(now: number) {
    const room = this.room!;
    for (const p of [...room.players]) {
      if (!p.connected && !p.dnf && p.droppedAt !== null && now - p.droppedAt >= ROOM_GRACE_MS) this.remove(p);
    }
    this.advance(now);
    this.fixHost();
  }

  /** The earliest player still here hosts; a dropped host keeps it while their slot is held. */
  protected fixHost() {
    const room = this.room!;
    const host = room.players.find((p) => p.id === room.hostId);
    if (host && !host.dnf) return;
    room.hostId = (room.players.find((p) => !p.dnf && p.connected) ?? room.players.find((p) => !p.dnf))?.id ?? null;
  }

  /** Saves the room and sets the alarm for the next thing that's due. */
  protected async commit() {
    const room = this.room;
    if (!room) return;
    const due = this.due();
    for (const p of room.players) if (!p.connected && !p.dnf && p.droppedAt !== null) due.push(p.droppedAt + ROOM_GRACE_MS);
    if (room.emptySince !== null) due.push(room.emptySince + IDLE_MS);
    await this.ctx.storage.put("room", room);
    if (due.length) await this.ctx.storage.setAlarm(Math.min(...due));
    else await this.ctx.storage.deleteAlarm();
  }

  // ---------- Sending ----------

  /** Players holding a slot (anyone but those who left mid-game). */
  protected seated() {
    return this.room!.players.filter((p) => !p.dnf);
  }

  protected broadcastRoom(exceptPid?: string) {
    if (this.room) this.broadcast({ type: "room", room: this.view() }, exceptPid);
  }

  protected broadcast(msg: M | CoreServerMessage<V>, exceptPid?: string) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      const pid = pidOf(ws);
      if (pid && pid !== exceptPid) sendText(ws, text);
    }
  }

  /** Sends to each seated player's socket whatever `msgFor` makes for them (nothing if it returns null). */
  protected broadcastEach(msgFor: (pid: string) => M | CoreServerMessage<V> | null) {
    for (const ws of this.ctx.getWebSockets()) {
      const pid = pidOf(ws);
      const msg = pid && msgFor(pid);
      if (msg) sendText(ws, JSON.stringify(msg));
    }
  }

  protected send(ws: WebSocket, msg: M | CoreServerMessage<V>) {
    sendText(ws, JSON.stringify(msg));
  }

  /** Tells the socket why it can't join, then closes it. */
  protected refuse(ws: WebSocket, code: RoomErrorCode) {
    this.send(ws, { type: "error", code });
    this.close(ws, 4000, code);
  }

  protected close(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  /** At most MAX_MESSAGES_PER_SECOND per socket; the rest are dropped. */
  private allow(ws: WebSocket) {
    const second = Math.floor(Date.now() / 1000);
    const rate = this.rates.get(ws);
    if (!rate || rate.second !== second) {
      this.rates.set(ws, { second, count: 1 });
      return true;
    }
    return ++rate.count <= MAX_MESSAGES_PER_SECOND;
  }
}

function pidOf(ws: WebSocket): string | null {
  return (ws.deserializeAttachment() as Attachment | null)?.pid ?? null;
}

function sendText(ws: WebSocket, text: string) {
  try {
    ws.send(text);
  } catch {
    // Closing; its close handler tidies up.
  }
}

function cleanName(name: string) {
  return name.replace(/[\p{C}]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
}

export function randomId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 10);
}
