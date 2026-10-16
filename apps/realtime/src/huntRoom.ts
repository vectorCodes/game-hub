// One Prop Hunt room: the lobby, then a match of rounds. Each round, hiders spread through the
// house and become props while the seekers wait blindfolded; then the seekers hunt them with
// zaps. Found hiders are out until the next round: they watch the others. The server is the only judge of roles, phases, disguises,
// zaps and scores; clients move themselves and show what it says. Joining, reconnecting, the
// host and saving are RoomCore's (roomCore.ts). See Prop-hunt-plan.md.
//
// What seekers mustn't learn: while hiders hide, seekers get none of their positions; while
// they seek, a hider who hasn't been found is known to seekers only by this round's tag.
import {
  HUNT_COUNTDOWN_MS,
  HUNT_DIZZY_MS,
  HUNT_FORCED_TAUNT,
  HUNT_HIDE_SECONDS,
  HUNT_HIT_HEAL,
  HUNT_HP,
  HUNT_HP_AFTER_DIZZY,
  HUNT_MAX_PLAYERS,
  HUNT_MAX_ROUNDS,
  HUNT_MIN_PLAYERS,
  HUNT_MISS_DAMAGE,
  HUNT_POINTS,
  HUNT_PROTOCOL_VERSION,
  HUNT_ROUND_RESULTS_MS,
  HUNT_SEEK_SECONDS,
  HUNT_SONAR_FROM_SECONDS_LEFT,
  HUNT_SONAR_SMALL_ROOM,
  HUNT_TAUNT_COOLDOWN_MS,
  HUNT_TAUNT_SOUNDS,
  HUNT_ZAP_COOLDOWN_MS,
  HUNT_ZAP_RANGE,
  HUNT_ZAP_SLACK,
  HuntClientMessage,
  canDisguiseAs,
  houseFor,
  newHouseSeed,
  rankHunt,
  seekersFor,
  type HuntLastRound,
  type HuntRole,
  type HuntSide,
  type HuntServerMessage,
  type HuntStanding,
  type HuntStatus,
  type HuntView,
} from "@shadow/shared";
import { RoomCore, randomId, type CorePlayer, type CoreRoom } from "./roomCore";

interface Player extends CorePlayer {
  role: HuntRole | null;
  found: boolean;
  hp: number;
  dizzyUntil: number | null;
  score: number;
  /** Points made this round (for the round's results). */
  roundPoints: number;
  spawn: number;
  /** Rounds spent seeking from the start: seekers are picked from those who've sought least. */
  turns: number;
  /** What seekers know this hider by, this round. */
  tag: string;
  /** The kind of prop they've become, or null. */
  disguise: string | null;
  /** Last reported position (world units), for checking zaps and the sonar. */
  pos: [number, number, number] | null;
  lastZapAt: number;
  lastTauntAt: number;
  sonarUsed: boolean;
}

interface Room extends CoreRoom<Player, HuntStatus> {
  round: number;
  rounds: number;
  phaseEndsAt: number | null;
  seekStartedAt: number | null;
  /** Next survival points, and next forced taunt, while seeking. */
  nextSurviveAt: number | null;
  nextForcedAt: number | null;
  lastRound: HuntLastRound | null;
  standings: HuntStanding[] | null;
  /** This round's house (`houseFor`): a new one every round. */
  mapSeed: number;
}

type Msg = HuntServerMessage;

export class HuntRoom extends RoomCore<Player, HuntStatus, Room, HuntClientMessage, HuntView, Msg> {
  protected readonly maxPlayers = HUNT_MAX_PLAYERS;
  protected readonly protocolVersion = HUNT_PROTOCOL_VERSION;

  protected newRoom(code: string): Room {
    return {
      code,
      status: "lobby",
      hostId: null,
      players: [],
      emptySince: Date.now(),
      round: 0,
      rounds: 0,
      phaseEndsAt: null,
      seekStartedAt: null,
      nextSurviveAt: null,
      nextForcedAt: null,
      lastRound: null,
      standings: null,
      mapSeed: newHouseSeed(),
    };
  }

  protected newPlayer(core: CorePlayer): Player {
    return {
      ...core,
      role: null,
      found: false,
      hp: HUNT_HP,
      dizzyUntil: null,
      score: 0,
      roundPoints: 0,
      spawn: 0,
      turns: 0,
      tag: randomId(),
      disguise: null,
      pos: null,
      lastZapAt: 0,
      lastTauntAt: 0,
      sonarUsed: false,
    };
  }

  protected parse(data: unknown) {
    return HuntClientMessage.parse(data);
  }

  protected playing() {
    const status = this.room!.status;
    return status !== "lobby" && status !== "results";
  }

  protected async handle(ws: WebSocket, me: Player, msg: HuntClientMessage, now: number) {
    const room = this.room!;
    // The hot path: kept for zaps and relayed, nothing stored.
    if (msg.type === "pos") {
      // A found hider is out (watching): they're no longer in the house.
      if ((room.status !== "hide" && room.status !== "seek") || (me.role === "hider" && me.found)) return;
      me.pos = [msg.p[0] / 100, msg.p[1] / 100, msg.p[2] / 100];
      this.broadcastEach((pid) => (pid === me.id || !this.sees(pid, me) ? null : { type: "pos", id: this.idFor(me, pid), p: msg.p }));
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
        const seated = this.seated();
        const others = seated.filter((p) => p.id !== me.id);
        if (seated.length < HUNT_MIN_PLAYERS || others.some((p) => !p.ready || !p.connected)) return this.send(ws, { type: "error", code: "not_ready" });
        room.round = 0;
        room.rounds = Math.min(seated.length, HUNT_MAX_ROUNDS);
        room.lastRound = null;
        room.standings = null;
        for (const p of seated) Object.assign(p, { score: 0, turns: 0 });
        this.setupRound();
        room.status = "countdown";
        room.phaseEndsAt = now + HUNT_COUNTDOWN_MS;
        break;
      }

      case "disguise": {
        if (!this.hiding(me)) return;
        const map = houseFor(room.mapSeed);
        if (msg.prop !== null && !canDisguiseAs(map, msg.prop)) return this.send(ws, { type: "error", code: "bad_message" });
        me.disguise = msg.prop === null ? null : map.props[msg.prop].kind;
        this.broadcastEach((pid) => (pid === me.id ? null : { type: "disguised", id: this.idFor(me, pid), kind: me.disguise }));
        break;
      }

      case "zap":
        if (room.status !== "seek" || me.role !== "seeker" || (me.dizzyUntil !== null && now < me.dizzyUntil)) return;
        if (now - me.lastZapAt < HUNT_ZAP_COOLDOWN_MS) return;
        me.lastZapAt = now;
        this.zap(me, msg.target, msg.at, now);
        this.tick(now);
        break;

      case "taunt": {
        if (!this.hiding(me) || now - me.lastTauntAt < HUNT_TAUNT_COOLDOWN_MS) return;
        me.lastTauntAt = now;
        if (room.status === "seek") this.award(me, HUNT_POINTS.taunt);
        this.taunt(me, false);
        break;
      }

      case "sonar": {
        if (room.status !== "seek" || me.role !== "seeker" || me.sonarUsed || !me.pos) return;
        if ((room.phaseEndsAt! - now) / 1000 > this.sonarFrom()) return;
        const target = this.nearestHidden(me.pos);
        if (!target?.pos) return;
        me.sonarUsed = true;
        const dx = target.pos[0] - me.pos[0];
        const dz = target.pos[2] - me.pos[2];
        const len = Math.hypot(dx, dz) || 1;
        this.send(ws, { type: "sonar", dir: [dx / len, dz / len] });
        break;
      }

      case "rematch":
        if (room.status !== "results") return;
        room.players = room.players.filter((p) => !p.dnf);
        for (const p of room.players) Object.assign(p, this.roundReset(), { ready: false, role: null, score: 0, turns: 0 });
        Object.assign(room, { status: "lobby", round: 0, rounds: 0, phaseEndsAt: null, seekStartedAt: null, nextSurviveAt: null, nextForcedAt: null, lastRound: null, standings: null });
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

  /** Everything a player starts a round with (besides their role). */
  private roundReset() {
    return { found: false, hp: HUNT_HP, dizzyUntil: null, roundPoints: 0, disguise: null, pos: null, lastZapAt: 0, lastTauntAt: 0, sonarUsed: false, tag: randomId() };
  }

  /** The next round's roles: seekers from those who've sought least (ties at random), everyone else hides. */
  private setupRound() {
    const room = this.room!;
    room.round += 1;
    room.mapSeed = newHouseSeed();
    const map = houseFor(room.mapSeed);
    const seated = shuffle(this.seated());
    const seekers = new Set(seated.slice().sort((a, b) => a.turns - b.turns).slice(0, seekersFor(seated.length)));
    const start = Math.floor(Math.random() * map.hiderSpawns.length);
    let next = 0;
    for (const p of seated) {
      const seeker = seekers.has(p);
      Object.assign(p, this.roundReset(), { role: seeker ? "seeker" : "hider", spawn: seeker ? 0 : (start + next++) % map.hiderSpawns.length });
      if (seeker) p.turns += 1;
    }
    room.seekStartedAt = room.nextSurviveAt = room.nextForcedAt = null;
  }

  private beginHide(at: number) {
    const room = this.room!;
    room.status = "hide";
    room.phaseEndsAt = at + HUNT_HIDE_SECONDS * 1000;
  }

  private beginSeek(at: number) {
    const room = this.room!;
    room.status = "seek";
    room.seekStartedAt = at;
    room.phaseEndsAt = at + HUNT_SEEK_SECONDS * 1000;
    room.nextSurviveAt = at + HUNT_POINTS.surviveEverySeconds * 1000;
    room.nextForcedAt = room.phaseEndsAt - HUNT_FORCED_TAUNT.fromSecondsLeft * 1000;
    // Still themselves when the seekers come out: everyone gets a look at them.
    const bare = this.hidden().filter((p) => p.disguise === null);
    if (bare.length) this.broadcastEach((pid) => ({ type: "exposed", ids: bare.map((p) => this.idFor(p, pid)) }));
  }

  private endRound(at: number, winners: HuntSide) {
    const room = this.room!;
    if (winners === "hiders") for (const p of this.hidden()) this.award(p, HUNT_POINTS.surviveRound);
    room.lastRound = { round: room.round, winners, points: Object.fromEntries(room.players.map((p) => [p.id, p.roundPoints])) };
    room.status = "round";
    room.phaseEndsAt = at + HUNT_ROUND_RESULTS_MS;
    room.nextSurviveAt = room.nextForcedAt = null;
  }

  private endMatch() {
    const room = this.room!;
    room.status = "results";
    room.phaseEndsAt = null;
    room.standings = rankHunt(room.players);
    this.broadcast({ type: "results", standings: room.standings });
  }

  /** Moves the match along: phases ending, survival points, forced taunts, a side running out of players. */
  protected advance(now: number) {
    const room = this.room!;
    // A few passes, in case several things fell due at once (after hibernation, say).
    for (let pass = 0; pass < 8; pass++) {
      const at = room.phaseEndsAt;
      if (room.status === "countdown" && at !== null && now >= at) {
        this.beginHide(at);
        continue;
      }
      if (room.status === "hide" || room.status === "seek") {
        if (this.hidden().length === 0) {
          this.endRound(now, "seekers");
          continue;
        }
        // Nobody left to seek, and nobody to spare to take over: the hiders have it.
        if (!this.keepASeeker()) {
          this.endRound(now, "hiders");
          continue;
        }
      }
      if (room.status === "hide" && at !== null && now >= at) {
        this.beginSeek(at);
        continue;
      }
      if (room.status === "seek") {
        const end = room.phaseEndsAt!;
        while (room.nextSurviveAt !== null && room.nextSurviveAt <= Math.min(now, end)) {
          for (const p of this.hidden()) this.award(p, HUNT_POINTS.survive);
          room.nextSurviveAt += HUNT_POINTS.surviveEverySeconds * 1000;
        }
        while (room.nextForcedAt !== null && room.nextForcedAt <= now && room.nextForcedAt < end) {
          for (const p of this.hidden()) this.taunt(p, true);
          room.nextForcedAt += HUNT_FORCED_TAUNT.everyMs;
        }
        if (now >= end) {
          this.endRound(end, "hiders");
          continue;
        }
      }
      if (room.status === "round" && at !== null && now >= at) {
        if (room.round >= room.rounds || this.seated().length < HUNT_MIN_PLAYERS) {
          this.endMatch();
        } else {
          this.setupRound();
          this.beginHide(at);
        }
        continue;
      }
      break;
    }
  }

  protected due() {
    const room = this.room!;
    if (room.status === "seek") return [room.phaseEndsAt, room.nextSurviveAt, room.nextForcedAt].filter((t): t is number => t !== null);
    return room.phaseEndsAt !== null && this.playing() ? [room.phaseEndsAt] : [];
  }

  /** If every seeker left, a hider still hidden takes over; false if there's nobody to spare. */
  private keepASeeker(): boolean {
    if (this.seated().some((p) => p.role === "seeker")) return true;
    const hidden = this.hidden();
    if (hidden.length < 2) return false;
    const p = hidden[Math.floor(Math.random() * hidden.length)];
    Object.assign(p, { role: "seeker", disguise: null, hp: HUNT_HP });
    this.broadcast({ type: "found", id: p.id, tag: p.tag, by: "" });
    return true;
  }

  // ---------- Zaps, taunts ----------

  private zap(me: Player, target: string | null, at: [number, number, number], now: number) {
    const room = this.room!;
    const hit = target === null ? undefined : this.hidden().find((p) => p.tag === target || p.id === target);
    const inRange = hit?.pos && me.pos && Math.hypot(hit.pos[0] - me.pos[0], hit.pos[1] - me.pos[1], hit.pos[2] - me.pos[2]) <= HUNT_ZAP_RANGE + HUNT_ZAP_SLACK;
    const beam: [number, number, number] = [at[0] / 100, at[1] / 100, at[2] / 100];
    if (hit && inRange) {
      const last = this.hidden().length === 1;
      Object.assign(hit, { found: true, disguise: null });
      if (last) this.award(hit, HUNT_POINTS.lastStanding);
      const quick = now - room.seekStartedAt! <= HUNT_POINTS.quickSeconds * 1000;
      this.award(me, HUNT_POINTS.find + (quick ? HUNT_POINTS.quickFind : 0));
      me.hp = Math.min(HUNT_HP, me.hp + HUNT_HIT_HEAL);
      this.broadcast({ type: "zapped", by: me.id, target: hit.id, hit: true, at: beam });
      this.broadcast({ type: "found", id: hit.id, tag: hit.tag, by: me.id });
      return;
    }
    me.hp -= HUNT_MISS_DAMAGE;
    if (me.hp <= 0) {
      me.dizzyUntil = now + HUNT_DIZZY_MS;
      me.hp = HUNT_HP_AFTER_DIZZY;
    }
    this.broadcast({ type: "zapped", by: me.id, target: null, hit: false, at: beam });
  }

  private taunt(p: Player, forced: boolean) {
    const sound = Math.floor(Math.random() * HUNT_TAUNT_SOUNDS);
    this.broadcastEach((pid) => ({ type: "taunt", id: this.idFor(p, pid), sound, forced }));
  }

  private nearestHidden(from: [number, number, number]) {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.hidden()) {
      if (!p.pos) continue;
      const d = Math.hypot(p.pos[0] - from[0], p.pos[2] - from[2]);
      if (d < bestD) [best, bestD] = [p, d];
    }
    return best;
  }

  private sonarFrom() {
    return this.seated().length <= HUNT_SONAR_SMALL_ROOM.players ? HUNT_SONAR_SMALL_ROOM.fromSecondsLeft : HUNT_SONAR_FROM_SECONDS_LEFT;
  }

  // ---------- Who is who ----------

  /** Hiders this round who haven't been found (and haven't left). */
  private hidden() {
    return this.seated().filter((p) => p.role === "hider" && !p.found);
  }

  /** Can act as a hider right now: become props, taunt. */
  private hiding(p: Player) {
    const status = this.room!.status;
    return (status === "hide" || status === "seek") && p.role === "hider" && !p.found;
  }

  private isSeeker(pid: string) {
    return this.room!.players.find((p) => p.id === pid)?.role === "seeker";
  }

  /** How `viewer` knows `p`: an unfound hider is only a tag to seekers. */
  private idFor(p: Player, viewer: string) {
    return p.role === "hider" && !p.found && this.isSeeker(viewer) ? p.tag : p.id;
  }

  /** Whether `viewer` may get `p`'s position: seekers are blindfolded while hiders hide. */
  private sees(viewer: string, p: Player) {
    return !(this.room!.status === "hide" && p.role === "hider" && this.isSeeker(viewer));
  }

  private award(p: Player, points: number) {
    p.score += points;
    p.roundPoints += points;
  }

  /** A player left mid-match: if they were the last hider or seeker, the round sorts itself out on the next tick. */
  protected abandon(p: Player) {
    p.disguise = null;
  }

  /** Someone (re)joining mid-match learns the disguises they're allowed to know, and the results if it's over. */
  protected afterWelcome(ws: WebSocket, me: Player) {
    const room = this.room!;
    for (const p of this.hidden()) {
      if (p.id !== me.id && p.disguise !== null) this.send(ws, { type: "disguised", id: this.idFor(p, me.id), kind: p.disguise });
    }
    if (room.status === "results" && room.standings) this.send(ws, { type: "results", standings: room.standings });
  }

  protected view(): HuntView {
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
        role: p.role,
        found: p.found,
        hp: p.hp,
        dizzyUntil: p.dizzyUntil,
        score: p.score,
        spawn: p.spawn,
      })),
      round: room.round,
      rounds: room.rounds,
      phaseEndsAt: room.phaseEndsAt,
      seekStartedAt: room.seekStartedAt,
      lastRound: room.lastRound,
      mapSeed: room.mapSeed,
    };
  }
}

function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
