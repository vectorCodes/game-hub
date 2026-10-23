// One Bumper Arena party room: 2–4 friends, every ring for itself, a match of rounds on the
// floating arenas. The room runs the physics (bumperSim.ts, 60 steps a second while a round is
// on) and is the only judge of hits, falls, knockouts and points; clients send their stick and
// buttons and draw the snapshots it sends back, 15 a second. A finished match is reported to
// the API, so signed-in players earn XP and coins. Joining, reconnecting, the host and saving
// are RoomCore's (roomCore.ts). See Bumper-arena-plan.md.
//
// The sim lives only in memory (a running round keeps the object awake): a room woken
// mid-round, after a deploy say, plays that round again from the countdown.
import {
  BUMPER_DEFAULT_ROUNDS,
  BUMPER_EMOTE_COOLDOWN_MS,
  BUMPER_KO_POINTS,
  BUMPER_MAPS,
  BUMPER_MAX_PLAYERS,
  BUMPER_MIN_PLAYERS,
  BUMPER_PROTOCOL_VERSION,
  BUMPER_RESULTS_SECRET_HEADER,
  BUMPER_ROTATION,
  BUMPER_ROUND_MAX_SECONDS,
  BUMPER_ROUND_RESULTS_MS,
  BUMPER_SNAP_EVERY,
  BUMPER_STEP,
  BumperClientMessage,
  BumperSim,
  packPatches,
  packPickups,
  packRing,
  packTiles,
  placePoints,
  rankBumper,
  roundPlaces,
  type BumperEvent,
  type BumperResultsBody,
  type BumperRoundResult,
  type BumperServerMessage,
  type BumperSettings,
  type BumperSnap,
  type BumperStanding,
  type BumperStatus,
  type BumperView,
  type BumperXpGain,
} from "@shadow/shared";
import { RoomCore, randomId, type CorePlayer, type CoreRoom } from "./roomCore";

/** Once a round is won, the sim runs on this long so the last fall finishes on screen. */
const RUN_ON_MS = 2000;
/** Steps made up at most in one go, after the loop was held up. */
const MAX_CATCH_UP = 12;
const STEP_MS = BUMPER_STEP * 1000;

interface Player extends CorePlayer {
  /** Ring colour, 0–3, for as long as they're in the room. */
  color: number;
  score: number;
  roundWins: number;
  kos: number;
  /** The latest stick (-1–1) and brace. */
  input: { x: number; z: number; brace: boolean };
  /** The last dash count heard; a new one waits for the next step. */
  dashCount: number;
  dashPending: boolean;
  /** Echoed in snapshots, for prediction: the player's step count at their last input, and steps run with it since. */
  ack: number;
  since: number;
  /** The last match's XP and coins, once the API has saved them (null: it couldn't). */
  xp?: BumperXpGain | null;
  lastEmoteAt?: number;
}

interface Room extends CoreRoom<Player, BumperStatus> {
  settings: BumperSettings;
  round: number;
  rounds: number;
  /** This match's arenas in order: a shuffled rotation, or the one picked. */
  maps: string[];
  map: string | null;
  entrants: string[];
  phaseEndsAt: number | null;
  lastRound: BumperRoundResult | null;
  standings: BumperStanding[] | null;
  /** This match, as reported to the API (a retried report counts once). */
  matchId?: string;
}

type Msg = BumperServerMessage;

const STILL = { x: 0, z: 0, brace: false };

export class BumperRoom extends RoomCore<Player, BumperStatus, Room, BumperClientMessage, BumperView, Msg> {
  protected readonly maxPlayers = BUMPER_MAX_PLAYERS;
  protected readonly protocolVersion = BUMPER_PROTOCOL_VERSION;
  // Inputs come at up to 15 a second, plus pings.
  protected readonly maxMessagesPerSecond = 30;

  private sim: BumperSim | null = null;
  private loop: ReturnType<typeof setInterval> | null = null;
  /** Wall time the round's sim started, and the steps run since. */
  private startedAt = 0;
  private steps = 0;
  /** The sim's events since the last snapshot. */
  private events: BumperEvent[] = [];
  private stopAt: number | null = null;

  protected newRoom(code: string): Room {
    return {
      code,
      status: "lobby",
      hostId: null,
      players: [],
      emptySince: Date.now(),
      settings: { map: BUMPER_ROTATION, rounds: BUMPER_DEFAULT_ROUNDS, pickups: true },
      round: 0,
      rounds: 0,
      maps: [],
      map: null,
      entrants: [],
      phaseEndsAt: null,
      lastRound: null,
      standings: null,
    };
  }

  protected newPlayer(core: CorePlayer): Player {
    const taken = new Set(this.room!.players.map((p) => p.color));
    const color = [0, 1, 2, 3].find((c) => !taken.has(c)) ?? 0;
    return { ...core, color, score: 0, roundWins: 0, kos: 0, input: { ...STILL }, dashCount: 0, dashPending: false, ack: -1, since: 0 };
  }

  protected parse(data: unknown) {
    return BumperClientMessage.parse(data);
  }

  protected playing() {
    const status = this.room!.status;
    return status === "round" || status === "roundOver";
  }

  protected async handle(ws: WebSocket, me: Player, msg: BumperClientMessage, now: number) {
    const room = this.room!;
    // The hot path: kept for the next step, nothing stored.
    if (msg.type === "input") {
      if (room.status !== "round") return;
      me.input = { x: msg.x / 100, z: msg.z / 100, brace: msg.b };
      if (msg.d !== me.dashCount) {
        me.dashCount = msg.d;
        me.dashPending = true;
      }
      me.ack = msg.s;
      me.since = 0;
      return;
    }
    // Relayed, nothing stored.
    if (msg.type === "emote") {
      if (!this.playing() || now - (me.lastEmoteAt ?? 0) < BUMPER_EMOTE_COOLDOWN_MS) return;
      me.lastEmoteAt = now;
      this.broadcast({ type: "emote", id: me.id, emote: msg.emote });
      return;
    }

    this.tick(now);
    switch (msg.type) {
      case "ready":
        if (room.status !== "lobby") return;
        me.ready = msg.on;
        break;

      case "settings":
        if (room.status !== "lobby") return;
        if (me.id !== room.hostId) return this.send(ws, { type: "error", code: "not_host" });
        room.settings = msg.settings;
        break;

      case "start": {
        if (room.status !== "lobby") return;
        if (me.id !== room.hostId) return this.send(ws, { type: "error", code: "not_host" });
        const seated = this.seated();
        if (seated.length < BUMPER_MIN_PLAYERS || seated.some((p) => p.id !== me.id && (!p.ready || !p.connected))) {
          return this.send(ws, { type: "error", code: "not_ready" });
        }
        for (const p of seated) Object.assign(p, { score: 0, roundWins: 0, kos: 0, xp: undefined });
        const { map, rounds } = room.settings;
        Object.assign(room, {
          round: 0,
          rounds,
          maps: map === BUMPER_ROTATION ? shuffle(Object.keys(BUMPER_MAPS)) : [map],
          lastRound: null,
          standings: null,
          matchId: `${room.code}-${randomId()}`,
        });
        this.startRound(now);
        break;
      }

      case "rematch":
        if (room.status !== "results") return;
        room.players = room.players.filter((p) => !p.dnf);
        for (const p of room.players) Object.assign(p, { ready: false, score: 0, roundWins: 0, kos: 0 });
        Object.assign(room, { status: "lobby", round: 0, rounds: 0, maps: [], map: null, entrants: [], phaseEndsAt: null, lastRound: null, standings: null });
        this.fixHost();
        break;

      default:
        // hello, ping and leave are RoomCore's.
        return;
    }
    this.broadcastRoom();
    await this.commit();
  }

  // ---------- Rounds ----------

  /** The next round: everyone seated gets a ring, on the next arena. */
  private startRound(now: number) {
    const room = this.room!;
    room.round += 1;
    room.map = room.maps[(room.round - 1) % room.maps.length];
    room.entrants = this.seated().map((p) => p.id);
    room.status = "round";
    room.phaseEndsAt = null;
    for (const p of this.seated()) Object.assign(p, { input: { ...STILL }, dashPending: false, ack: -1, since: 0 });
    this.sim = new BumperSim(
      BUMPER_MAPS[room.map] ?? BUMPER_MAPS["picnic-plate"],
      room.entrants.map((id) => ({ id, name: this.player(id)?.name ?? "", bot: false })),
      undefined,
      // Rooms saved before pickups existed have them on.
      { pickups: room.settings.pickups ?? true, seed: `${room.matchId ?? room.code}:${room.round}` },
    );
    this.startedAt = now;
    this.steps = 0;
    this.events = [];
    this.stopAt = null;
    this.loop ??= setInterval(() => this.run(), 25);
  }

  /** The loop: as many steps as the clock says are due, a snapshot every few. */
  private run() {
    const sim = this.sim;
    const room = this.room;
    if (!sim || !room) return this.stopLoop();
    const now = Date.now();
    let due = Math.floor((now - this.startedAt) / STEP_MS);
    // Held up for a long while: skip ahead rather than race to catch up.
    if (due - this.steps > MAX_CATCH_UP) {
      due = this.steps + MAX_CATCH_UP;
      this.startedAt = now - due * STEP_MS;
    }
    while (this.steps < due) {
      this.steps++;
      for (const id of room.entrants) {
        const p = this.player(id);
        const r = sim.ring(id);
        if (!p || !r) continue;
        // Gone (dropped, or left): the ring coasts, and can still be bumped out.
        const input = p.connected && !p.dnf ? p.input : STILL;
        r.input = { ...input, dash: p.dashPending };
        p.dashPending = false;
        p.since++;
      }
      sim.step(BUMPER_STEP);
      if (sim.phase === "play" && sim.t >= BUMPER_ROUND_MAX_SECONDS) sim.timeUp();
      const over = sim.events.some((e) => e.type === "over");
      this.events.push(...sim.events);
      sim.events.length = 0;
      if (over) this.endRound(now);
      else if (this.steps % BUMPER_SNAP_EVERY === 0) this.snapshot();
    }
    if (this.stopAt !== null && now >= this.stopAt) {
      this.snapshot();
      this.sim = null;
      this.stopLoop();
    }
  }

  private stopLoop() {
    if (this.loop !== null) clearInterval(this.loop);
    this.loop = null;
  }

  private snapshot() {
    const sim = this.sim!;
    const room = this.room!;
    const msg: BumperSnap = {
      type: "snap",
      n: this.steps,
      t: Math.round(sim.t * 1000),
      phase: sim.phase,
      winner: sim.winner,
      rings: room.entrants.map((id) => {
        const p = this.player(id);
        return packRing(sim.ring(id)!, p?.ack ?? -1, p?.since ?? 0);
      }),
      events: this.events.map(tidy),
    };
    if (sim.map.kind === "spinner") msg.spin = Math.round(sim.spinner.angle * 1000);
    if (sim.map.kind === "hex") msg.tiles = packTiles(sim.tiles);
    if (sim.pickups.length) msg.pickups = packPickups(sim.pickups, sim.t);
    if (sim.patches.length) msg.patches = packPatches(sim.patches);
    this.events = [];
    this.broadcast(msg);
  }

  /** The round is won (or time's up): places, points, and the round's results for a while. */
  private endRound(now: number) {
    const sim = this.sim!;
    const room = this.room!;
    this.snapshot();
    const places = roundPlaces(sim.rings);
    const points: Record<string, number> = {};
    const kos: Record<string, number> = {};
    for (const r of sim.rings) {
      kos[r.id] = r.kos;
      points[r.id] = placePoints(places[r.id], places) + r.kos * BUMPER_KO_POINTS;
      const p = this.player(r.id);
      if (!p) continue;
      p.score += points[r.id];
      p.kos += r.kos;
      if (places[r.id] === 1) p.roundWins += 1;
    }
    room.lastRound = { round: room.round, map: room.map!, places, points, kos };
    room.status = "roundOver";
    room.phaseEndsAt = now + BUMPER_ROUND_RESULTS_MS;
    this.stopAt = now + RUN_ON_MS;
    this.broadcastRoom();
    void this.commit();
  }

  private endMatch() {
    const room = this.room!;
    room.status = "results";
    room.phaseEndsAt = null;
    room.standings = rankBumper(
      room.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, score: p.score, roundWins: p.roundWins, kos: p.kos, dnf: p.dnf })),
    );
    this.broadcast({ type: "results", standings: room.standings });
    this.ctx.waitUntil(this.reportResults(room.matchId ?? `${room.code}-${Date.now()}`, room.standings));
  }

  /**
   * Tells the API how the match went, so signed-in players earn XP and coins, then tells each of
   * them what they got. The API may be asleep (it wakes in under a minute), so it gets a few tries.
   */
  private async reportResults(matchId: string, standings: BumperStanding[]) {
    const room = this.room!;
    const signedIn = standings.flatMap((s) => {
      const p = room.players.find((q) => q.id === s.id);
      return p?.key.startsWith("u:") ? [{ p, row: { userId: p.key.slice(2), place: s.place, score: s.score, roundWins: s.roundWins, kos: s.kos, dnf: s.dnf } }] : [];
    });
    if (!signedIn.length) return;
    const { API_URL, HUNT_RESULTS_SECRET } = this.env;
    let gains: BumperXpGain[] | null = null;
    if (API_URL && HUNT_RESULTS_SECRET) {
      const body: BumperResultsBody = { matchId, players: signedIn.map((s) => s.row) };
      for (const wait of [0, 10_000, 30_000]) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        try {
          const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/bumper-arena/results`, {
            method: "POST",
            headers: { "content-type": "application/json", [BUMPER_RESULTS_SECRET_HEADER]: HUNT_RESULTS_SECRET },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60_000),
          });
          if (res.ok) {
            gains = ((await res.json()) as { players: BumperXpGain[] }).players;
            break;
          }
          // A bad secret or a bad report won't get better by trying again.
          if (res.status < 500) break;
        } catch {
          // Unreachable, or timed out while it woke: try again.
        }
      }
    }
    for (const { p, row } of signedIn) {
      p.xp = gains?.find((g) => g.userId === row.userId) ?? null;
      this.broadcastEach((pid) => (pid === p.id ? { type: "xp", gain: p.xp ?? null } : null));
    }
    await this.commit();
  }

  /** Moves the match along: a round's results ending, and a round lost to a restart. */
  protected advance(now: number) {
    const room = this.room!;
    if (room.status === "round" && !this.sim) {
      room.round -= 1;
      this.startRound(now);
    }
    if (room.status === "roundOver" && room.phaseEndsAt !== null && now >= room.phaseEndsAt) {
      if (room.round >= room.rounds || this.seated().length < BUMPER_MIN_PLAYERS) this.endMatch();
      else this.startRound(now);
    }
  }

  protected due() {
    const room = this.room!;
    if (room.status === "roundOver" && room.phaseEndsAt !== null) return [room.phaseEndsAt];
    // During a round, a check now and then: if the room was woken without its sim, the round restarts.
    if (room.status === "round") return [Date.now() + 30_000];
    return [];
  }

  // ---------- Players ----------

  private player(id: string) {
    return this.room!.players.find((p) => p.id === id);
  }

  /** Left mid-match: their ring coasts on (the loop gives it no input). */
  protected abandon(p: Player) {
    p.input = { ...STILL };
  }

  protected afterWelcome(ws: WebSocket, me: Player) {
    const room = this.room!;
    if (room.status === "results" && room.standings) this.send(ws, { type: "results", standings: room.standings });
    if (room.status === "results" && me.xp !== undefined) this.send(ws, { type: "xp", gain: me.xp });
  }

  protected view(): BumperView {
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
        dnf: p.dnf,
        color: p.color,
        score: p.score,
        roundWins: p.roundWins,
        kos: p.kos,
      })),
      settings: room.settings,
      round: room.round,
      rounds: room.rounds,
      map: room.map,
      entrants: room.entrants,
      phaseEndsAt: room.phaseEndsAt,
      lastRound: room.lastRound,
    };
  }
}

/** An event as sent: positions to the centimetre. */
function tidy(e: BumperEvent): BumperEvent {
  const r = (v: number) => Math.round(v * 100) / 100;
  if (e.type === "hit") return { ...e, x: r(e.x), z: r(e.z), power: r(e.power) };
  if (e.type === "crack" || e.type === "tileDrop" || e.type === "spawn" || e.type === "pickup" || e.type === "shock") return { ...e, x: r(e.x), z: r(e.z) };
  return e;
}

function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
