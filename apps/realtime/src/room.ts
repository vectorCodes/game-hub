// One Sky Climb room: the lobby, the countdown, the race and its results, for up to
// ROOM_MAX_PLAYERS players. It is the only judge of who started and who won; clients just show
// what it says. Joining, reconnecting, the host and saving are RoomCore's (roomCore.ts).
import {
  CLIMB_MIN_SECONDS_PER_FLOOR,
  CLIMB_TOP_FLOOR,
  ROOM_COUNTDOWN_MS,
  ROOM_MAX_PLAYERS,
  ROOM_PROTOCOL_VERSION,
  ROOM_RACE_SECONDS,
  RoomClientMessage,
  climbTop,
  rankRoom,
  type RoomServerMessage,
  type RoomStanding,
  type RoomStatus,
  type RoomView,
} from "@shadow/shared";
import { RoomCore, randomId, type CorePlayer, type CoreRoom } from "./roomCore";

interface Player extends CorePlayer {
  floor: number;
  /** Ms from the start to reaching `floor`. */
  floorMs: number | null;
  finished: boolean;
}

interface Room extends CoreRoom<Player, RoomStatus> {
  seed: string | null;
  startAt: number | null;
  endsAt: number | null;
  round: number;
  standings: RoomStanding[] | null;
}

export class ClimbRoom extends RoomCore<Player, RoomStatus, Room, RoomClientMessage, RoomView, RoomServerMessage> {
  protected readonly maxPlayers = ROOM_MAX_PLAYERS;
  protected readonly protocolVersion = ROOM_PROTOCOL_VERSION;

  protected newRoom(code: string): Room {
    return { code, status: "lobby", hostId: null, players: [], seed: null, startAt: null, endsAt: null, round: 0, standings: null, emptySince: Date.now() };
  }

  protected newPlayer(core: CorePlayer): Player {
    return { ...core, floor: 0, floorMs: null, finished: false };
  }

  protected parse(data: unknown) {
    return RoomClientMessage.parse(data);
  }

  protected playing() {
    const status = this.room!.status;
    return status === "countdown" || status === "racing";
  }

  protected async handle(ws: WebSocket, me: Player, msg: RoomClientMessage, now: number) {
    const room = this.room!;
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
        room.seed = `room4-${room.code}-${room.round}-${randomId()}`;
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
        if (me.floor >= climbTop(room.seed!)) me.finished = true;
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

      default:
        // hello, ping and leave are RoomCore's.
        return;
    }
    this.broadcastRoom();
    await this.commit();
  }

  /** The start, then the end: when the time is up or nobody is still climbing. */
  protected advance(now: number) {
    const room = this.room!;
    if (room.status === "countdown" && now >= room.startAt!) room.status = "racing";
    if (room.status === "racing") {
      const climbing = room.players.filter((p) => !p.dnf && !p.finished);
      if (now >= room.endsAt! || climbing.length === 0) this.endRace();
    }
  }

  protected due() {
    const room = this.room!;
    if (room.status === "countdown") return [room.startAt!];
    if (room.status === "racing") return [room.endsAt!];
    return [];
  }

  /** Left mid-race: done climbing, placed last. */
  protected abandon(p: Player) {
    p.finished = true;
  }

  protected afterWelcome(ws: WebSocket) {
    const room = this.room!;
    if (room.status === "results" && room.standings) this.send(ws, { type: "results", standings: room.standings });
  }

  private endRace() {
    const room = this.room!;
    room.status = "results";
    room.standings = rankRoom(room.players, room.seed ? climbTop(room.seed) : CLIMB_TOP_FLOOR);
    this.broadcast({ type: "results", standings: room.standings });
  }

  protected view(): RoomView {
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
}
