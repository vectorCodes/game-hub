// One Sky Climb room: the lobby, the countdown, the race and its results, for up to
// ROOM_MAX_PLAYERS players. It is the only judge of who is in, who started and who won;
// clients just show what it says. Uses the WebSocket Hibernation API, so an idle lobby costs
// nothing; everything that must survive hibernation is saved to storage after each change.
import { DurableObject } from "cloudflare:workers";
import {
  CLIMB_FLOORS,
  CLIMB_MIN_SECONDS_PER_FLOOR,
  ROOM_COUNTDOWN_MS,
  ROOM_GRACE_MS,
  ROOM_MAX_PLAYERS,
  ROOM_PROTOCOL_VERSION,
  ROOM_RACE_SECONDS,
  RoomClientMessage,
  rankRoom,
  shortName,
  type AvatarConfig,
  type RoomErrorCode,
  type RoomPeek,
  type RoomServerMessage,
  type RoomStanding,
  type RoomStatus,
  type RoomView,
} from "@shadow/shared";
import { authConfigured, verifyToken } from "./auth";
import type { Env } from "./env";

/** Nobody connected for this long: the room is deleted and its code freed. */
const IDLE_MS = 30 * 60_000;
const MAX_MESSAGE_CHARS = 8192;
/** Per socket; positions come at 10 a second, so this leaves room for the rest. */
const MAX_MESSAGES_PER_SECOND = 20;

interface Player {
  id: string;
  /** Who gets this slot back on reconnecting: "u:<userId>" or "g:<clientId>". Never sent out. */
  key: string;
  name: string;
  avatar: AvatarConfig | null;
  ready: boolean;
  connected: boolean;
  /** When the connection dropped; the slot is held for ROOM_GRACE_MS. */
  droppedAt: number | null;
  floor: number;
  /** Ms from the start to reaching `floor`. */
  floorMs: number | null;
  finished: boolean;
  dnf: boolean;
}

interface Room {
  code: string;
  status: RoomStatus;
  hostId: string | null;
  /** In join order: the earliest one still here hosts. */
  players: Player[];
  seed: string | null;
  startAt: number | null;
  endsAt: number | null;
  round: number;
  standings: RoomStanding[] | null;
  /** When the last player disconnected (or the room was made), while nobody is connected. */
  emptySince: number | null;
}

/** Kept on each socket, so it survives hibernation. */
interface Attachment {
  pid: string | null;
}

type Hello = Extract<RoomClientMessage, { type: "hello" }>;

export class ClimbRoom extends DurableObject<Env> {
  private room: Room | null = null;
  private rates = new Map<WebSocket, { second: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<Room>("room")) ?? null;
    });
  }

  /** Opens the room under `code`; false if that code is already taken. */
  async init(code: string): Promise<boolean> {
    if (this.room) return false;
    this.room = {
      code,
      status: "lobby",
      hostId: null,
      players: [],
      seed: null,
      startAt: null,
      endsAt: null,
      round: 0,
      standings: null,
      emptySince: Date.now(),
    };
    await this.commit();
    return true;
  }

  async peek(): Promise<RoomPeek> {
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
    let msg: RoomClientMessage;
    try {
      msg = RoomClientMessage.parse(JSON.parse(data));
    } catch {
      return this.send(ws, { type: "error", code: "bad_message" });
    }
    const now = Date.now();
    if (msg.type === "ping") return this.send(ws, { type: "pong", t: msg.t, now });

    const room = this.room;
    if (!room) return this.refuse(ws, "not_found");
    if (msg.type === "hello") return this.hello(ws, msg);

    const me = room.players.find((p) => p.id === pidOf(ws));
    if (!me) return this.send(ws, { type: "error", code: "bad_message" });

    // The hot path: relayed as is, nothing stored.
    if (msg.type === "pos") {
      if (room.status === "racing" || room.status === "countdown") this.broadcast({ type: "pos", id: me.id, p: msg.p }, me.id);
      return;
    }

    this.tick(now);
    switch (msg.type) {
      case "ready":
        if (room.status !== "lobby") return;
        me.ready = msg.on;
        break;

      case "start": {
        if (room.status !== "lobby") return;
        if (me.id !== room.hostId) return this.send(ws, { type: "error", code: "not_host" });
        const others = this.seated().filter((p) => p.id !== me.id);
        if (others.some((p) => !p.ready || !p.connected)) return this.send(ws, { type: "error", code: "not_ready" });
        room.round += 1;
        room.seed = `room-${room.code}-${room.round}-${randomId()}`;
        room.startAt = now + ROOM_COUNTDOWN_MS;
        room.endsAt = room.startAt + ROOM_RACE_SECONDS * 1000;
        room.status = "countdown";
        room.standings = null;
        for (const p of room.players) Object.assign(p, { floor: 0, floorMs: null, finished: false });
        break;
      }

      case "progress": {
        if (room.status !== "racing" || me.finished || msg.floor <= me.floor) return;
        const elapsed = now - room.startAt!;
        // Faster than anyone can honestly climb: ignored.
        if (elapsed < msg.floor * CLIMB_MIN_SECONDS_PER_FLOOR * 1000) return;
        me.floor = msg.floor;
        me.floorMs = elapsed;
        if (me.floor >= CLIMB_FLOORS) me.finished = true;
        this.broadcast({ type: "progress", id: me.id, floor: me.floor, at: elapsed });
        this.tick(now);
        break;
      }

      case "finish":
        if (room.status !== "racing") return;
        me.finished = true;
        this.tick(now);
        break;

      case "rematch":
        if (room.status !== "results") return;
        room.players = room.players.filter((p) => !p.dnf);
        for (const p of room.players) Object.assign(p, { ready: false, floor: 0, floorMs: null, finished: false });
        Object.assign(room, { status: "lobby", seed: null, startAt: null, endsAt: null, standings: null });
        this.fixHost();
        break;

      case "leave":
        ws.serializeAttachment({ pid: null } satisfies Attachment);
        this.remove(me);
        this.tick(now);
        this.close(ws, 1000, "left");
        break;
    }
    this.broadcastRoom();
    await this.commit();
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
    if (msg.v !== ROOM_PROTOCOL_VERSION) return this.refuse(ws, "outdated");

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
    const racing = room.status === "countdown" || room.status === "racing";
    if (me?.dnf && racing) return this.refuse(ws, "started");
    if (me) {
      // Back (or in a new tab): this socket takes the slot over.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== ws && pidOf(other) === me.id) {
          other.serializeAttachment({ pid: null } satisfies Attachment);
          this.close(other, 4001, "replaced");
        }
      }
    } else {
      if (racing) return this.refuse(ws, "started");
      if (this.seated().length >= ROOM_MAX_PLAYERS) return this.refuse(ws, "full");
      me = { id: randomId(), key, name, avatar: null, ready: false, connected: true, droppedAt: null, floor: 0, floorMs: null, finished: false, dnf: false };
      room.players.push(me);
    }
    Object.assign(me, { name, avatar: msg.avatar, connected: true, droppedAt: null });
    room.emptySince = null;
    this.fixHost();
    ws.serializeAttachment({ pid: me.id } satisfies Attachment);

    this.send(ws, { type: "welcome", you: me.id, room: this.view() });
    if (room.status === "results" && room.standings) this.send(ws, { type: "results", standings: room.standings });
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

  /** Gone for good: out of the lobby, or a DNF if the race is on (they still get a place). */
  private remove(p: Player) {
    const room = this.room!;
    if (room.status === "countdown" || room.status === "racing") {
      Object.assign(p, { dnf: true, finished: true, connected: false });
    } else {
      room.players = room.players.filter((x) => x !== p);
    }
    if (!room.players.some((x) => x.connected)) room.emptySince ??= Date.now();
    this.fixHost();
  }

  // ---------- Time ----------

  /** Applies everything that's due by `now`: the start, held slots running out, the end. */
  private tick(now: number) {
    const room = this.room!;
    if (room.status === "countdown" && now >= room.startAt!) room.status = "racing";
    for (const p of [...room.players]) {
      if (!p.connected && !p.dnf && p.droppedAt !== null && now - p.droppedAt >= ROOM_GRACE_MS) this.remove(p);
    }
    if (room.status === "racing") {
      const climbing = room.players.filter((p) => !p.dnf && !p.finished);
      if (now >= room.endsAt! || climbing.length === 0) this.endRace();
    }
    this.fixHost();
  }

  private endRace() {
    const room = this.room!;
    room.status = "results";
    room.standings = rankRoom(room.players);
    this.broadcast({ type: "results", standings: room.standings });
  }

  /** The earliest player still here hosts; a dropped host keeps it while their slot is held. */
  private fixHost() {
    const room = this.room!;
    const host = room.players.find((p) => p.id === room.hostId);
    if (host && !host.dnf) return;
    room.hostId = (room.players.find((p) => !p.dnf && p.connected) ?? room.players.find((p) => !p.dnf))?.id ?? null;
  }

  /** Saves the room and sets the alarm for the next thing that's due. */
  private async commit() {
    const room = this.room;
    if (!room) return;
    const due: number[] = [];
    if (room.status === "countdown") due.push(room.startAt!);
    if (room.status === "racing") due.push(room.endsAt!);
    for (const p of room.players) if (!p.connected && !p.dnf && p.droppedAt !== null) due.push(p.droppedAt + ROOM_GRACE_MS);
    if (room.emptySince !== null) due.push(room.emptySince + IDLE_MS);
    await this.ctx.storage.put("room", room);
    if (due.length) await this.ctx.storage.setAlarm(Math.min(...due));
    else await this.ctx.storage.deleteAlarm();
  }

  // ---------- Sending ----------

  /** Players holding a slot (anyone but those who left mid-race). */
  private seated() {
    return this.room!.players.filter((p) => !p.dnf);
  }

  private view(): RoomView {
    const room = this.room!;
    return {
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        ready: p.ready,
        connected: p.connected,
        floor: p.floor,
        finished: p.finished,
        dnf: p.dnf,
      })),
      seed: room.seed,
      startAt: room.startAt,
      endsAt: room.endsAt,
      limitSec: ROOM_RACE_SECONDS,
      round: room.round,
    };
  }

  private broadcastRoom(exceptPid?: string) {
    if (this.room) this.broadcast({ type: "room", room: this.view() }, exceptPid);
  }

  private broadcast(msg: RoomServerMessage, exceptPid?: string) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      const pid = pidOf(ws);
      if (pid && pid !== exceptPid) sendText(ws, text);
    }
  }

  private send(ws: WebSocket, msg: RoomServerMessage) {
    sendText(ws, JSON.stringify(msg));
  }

  /** Tells the socket why it can't join, then closes it. */
  private refuse(ws: WebSocket, code: RoomErrorCode) {
    this.send(ws, { type: "error", code });
    this.close(ws, 4000, code);
  }

  private close(ws: WebSocket, code: number, reason: string) {
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

function randomId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 10);
}
