// A party round on our side. The room runs the physics; we draw what it says. Everyone else's
// ring is drawn a moment behind, blended between the room's snapshots (15 a second), and so
// are the arena and the room's events, so a bump is heard when it's seen. Our own ring is
// predicted: driven here with our input at once, and on each snapshot put back where the room
// had it and driven again through the inputs the room hadn't got to yet. Here our ring is ME,
// whatever the room calls it.
import {
  BUMPER_INPUT_HZ,
  BUMPER_INPUT_KEEPALIVE_MS,
  BUMPER_MAPS,
  BUMPER_STEP,
  DEFAULT_AVATAR,
  ringRadius,
  unpackPickups,
  unpackRing,
  unpackTiles,
  type BumperEvent,
  type BumperInput,
  type BumperSim,
  type BumperSnap,
  type Ring,
} from "@shadow/shared";
import { showEmote } from "./emotes";
import { input } from "./input";
import { bumperRoomState, onBumperMessage, onBumperRoomChange, sendBumper } from "./room";
import { emitBumperEvent, game, ME, RING_COLORS, syncHud, useBumper, type Entrant } from "./store";

/** Others are drawn this far behind (ms): snapshots come every 67 ms, so there are two to blend. */
const DELAY_MS = 110;
/** Our ring further than this (m) from where the room puts it jumps there; nearer, it eases over. */
const SNAP_DISTANCE = 1.5;
/** The share of that gap each snapshot closes. */
const EASE = 0.5;
/** Inputs kept for replaying, in steps (over 4 s). */
const HISTORY = 256;
const MAX_SNAPS = 20;

const STILL: BumperInput = { x: 0, z: 0, dash: false, brace: false };

const party = {
  /** The round being drawn (0: none). */
  round: 0,
  you: null as string | null,
  /** Our ring's place in the room's list of rings. */
  mine: -1,
  /** Snapshots, with when they arrived (ms, performance.now). */
  snaps: [] as { at: number; snap: BumperSnap }[],
  /** The room's events, held back until they're drawn. */
  events: [] as { at: number; e: BumperEvent }[],
  /** Our step count (it never resets), and the time left over towards the next step. */
  step: 0,
  acc: 0,
  history: new Array<{ step: number; input: BumperInput } | undefined>(HISTORY),
  /** What the room has from us: the stick (-100–100), brace, and the dash count. */
  sent: { x: 0, z: 0, b: false, d: 0 },
  sentAt: 0,
  /** A dash pressed, not sent yet. */
  dash: false,
  /** Our ring is ours to drive while it's on the arena; once it's off, it's drawn from snapshots like the rest. */
  predicting: false,
};

const local = (id: string) => (id === party.you ? ME : id);
const localOrNull = (id: string | null) => (id === null ? null : local(id));

// ---------- The room's word ----------

/** Keeps us in step with the room: a new round staged, or bots behind the lobby between matches. */
function syncRoom() {
  const { code, room, you } = bumperRoomState();
  if (!code || !room) {
    party.round = 0;
    return;
  }
  party.you = you;
  if (room.status === "lobby" || room.status === "results") {
    party.round = 0;
    useBumper.getState().partyBackdrop(room.settings.map in BUMPER_MAPS ? room.settings.map : "picnic-plate");
    return;
  }
  if (room.round === party.round || !room.map) return;
  party.round = room.round;
  party.mine = you ? room.entrants.indexOf(you) : -1;
  party.snaps = [];
  party.events = [];
  party.sentAt = 0;
  party.dash = false;
  party.predicting = party.mine >= 0;
  const entrants: Entrant[] = room.entrants.map((id) => {
    const p = room.players.find((q) => q.id === id);
    return {
      id: local(id),
      name: p?.name ?? "Player",
      bot: false,
      // Ours is the live one from the avatar store.
      avatar: id === you ? null : (p?.avatar ?? DEFAULT_AVATAR),
      color: RING_COLORS[p?.color ?? 0],
      level: null,
    };
  });
  useBumper.getState().stageParty(entrants, room.map);
}
onBumperRoomChange(syncRoom);

/** The room's events, in our names for the rings. Our own dashes we've already shown. */
function localEvent(e: BumperEvent): BumperEvent | null {
  switch (e.type) {
    case "dash":
      return local(e.id) === ME && party.predicting ? null : { ...e, id: local(e.id) };
    case "hit":
      return { ...e, a: local(e.a), b: local(e.b) };
    case "fall":
    case "pickup":
    case "shock":
    case "pop":
    case "slip":
      return { ...e, id: local(e.id) };
    case "out":
      return { ...e, id: local(e.id), by: localOrNull(e.by) };
    case "over":
      return { ...e, winner: localOrNull(e.winner) };
    default:
      return e;
  }
}

onBumperMessage((msg) => {
  const sim = game.sim;
  // Others' emotes (ours showed when we pressed the key).
  if (msg.type === "emote" && party.round && local(msg.id) !== ME) return showEmote(local(msg.id), msg.emote);
  if (msg.type !== "snap" || !party.round || !sim || useBumper.getState().backdrop) return;
  const at = performance.now();
  party.snaps.push({ at, snap: msg });
  if (party.snaps.length > MAX_SNAPS) party.snaps.shift();
  for (const e of msg.events) {
    const mine = localEvent(e);
    if (mine) party.events.push({ at: at + DELAY_MS, e: mine });
  }
  // The round's phase as it is now: our ring drives (or doesn't) by it.
  sim.phase = msg.phase;
  sim.winner = localOrNull(msg.winner);
  reconcile(sim, msg);
});

const scratch = {} as Ring;

/** Our ring, back where the room had it, then driven on through the inputs it hadn't applied yet. */
function reconcile(sim: BumperSim, snap: BumperSnap) {
  const me = sim.ring(ME);
  const s = snap.rings[party.mine];
  if (!me || !s || !party.predicting) return;
  Object.assign(scratch, me);
  unpackRing(s, scratch);
  // Off the edge: from here on it's drawn from the snapshots.
  if (scratch.state !== "in") {
    party.predicting = false;
    return;
  }
  // The room ran our input from step `ack` for `since` steps: it's that far into our history.
  const from = s[12] + s[13];
  if (s[12] >= 0 && from <= party.step && party.step - from < HISTORY) {
    for (let k = from; k < party.step; k++) {
      const h = party.history[k % HISTORY];
      scratch.input = h?.step === k ? h.input : STILL;
      sim.driveOnly(scratch, BUMPER_STEP);
    }
    sim.events.length = 0;
  }
  const gap = Math.hypot(scratch.x - me.x, scratch.z - me.z);
  const k = gap > SNAP_DISTANCE ? 1 : EASE;
  const x = me.x + (scratch.x - me.x) * k;
  const z = me.z + (scratch.z - me.z) * k;
  Object.assign(me, scratch, { x, z });
}

// ---------- Each frame ----------

/** Draws the party round: our ring a step at a time, everyone else and the arena from snapshots, the room's events as they come due. */
export function partyFrame(dt: number) {
  const sim = game.sim;
  if (!sim) return;
  party.acc += dt;
  while (party.acc >= BUMPER_STEP) {
    party.acc -= BUMPER_STEP;
    ownStep(sim);
  }
  const now = performance.now();
  drawOthers(sim, now);
  while (party.events.length && party.events[0].at <= now) emitBumperEvent(party.events.shift()!.e, sim);
  syncHud(sim);
}

/** One step of ours: send the input if it changed (or it's been a while), keep it for replays, and drive our ring with it. */
function ownStep(sim: BumperSim) {
  if (input.dashPressed) {
    party.dash = true;
    input.dashPressed = false;
  }
  const x = Math.round(input.x * 100);
  // Screen up is away from the camera: -z.
  const z = Math.round(-input.y * 100);
  const b = input.brace;
  const { sent } = party;
  const now = performance.now();
  const wait = now - party.sentAt;
  const changed = x !== sent.x || z !== sent.z || b !== sent.b || party.dash;
  let dash = false;
  const live = party.predicting && sim.phase !== "over" && bumperRoomState().connection === "open";
  if (live && ((changed && wait >= 1000 / BUMPER_INPUT_HZ) || wait >= BUMPER_INPUT_KEEPALIVE_MS)) {
    if (party.dash) {
      sent.d = (sent.d + 1) % 256;
      party.dash = false;
      dash = true;
    }
    Object.assign(sent, { x, z, b });
    sendBumper({ type: "input", s: party.step, x, z, b, d: sent.d });
    party.sentAt = now;
  }
  // We drive with what the room was sent, so a replay drives the same way.
  const applied: BumperInput = { x: sent.x / 100, z: sent.z / 100, brace: sent.b, dash };
  party.history[party.step % HISTORY] = { step: party.step, input: applied };
  party.step++;

  const me = sim.ring(ME);
  if (!me || !party.predicting || me.state !== "in") return;
  me.input = applied;
  sim.driveOnly(me, BUMPER_STEP);
  pushOut(sim, me);
  // Our own dash, seen and heard at once.
  for (const e of sim.events) emitBumperEvent(e, sim);
  sim.events.length = 0;
}

/** Keeps our ring from driving into the others while the room works out the bump. */
function pushOut(sim: BumperSim, me: Ring) {
  for (const r of sim.rings) {
    if (r === me || r.state !== "in") continue;
    const reach = ringRadius(me, sim.tuning) + ringRadius(r, sim.tuning);
    const dx = me.x - r.x;
    const dz = me.z - r.z;
    const d = Math.hypot(dx, dz);
    if (d >= reach || d < 1e-6) continue;
    me.x = r.x + (dx / d) * reach;
    me.z = r.z + (dz / d) * reach;
  }
}

/** Everyone else, the clock, the bar, the tiles and the pickups, `DELAY_MS` ago, blended between the snapshots around then. */
function drawOthers(sim: BumperSim, now: number) {
  const snaps = party.snaps;
  if (!snaps.length) return;
  const at = now - DELAY_MS;
  let i = snaps.length - 1;
  while (i > 0 && snaps[i - 1].at > at) i--;
  const b = snaps[i];
  const a = i > 0 ? snaps[i - 1] : b;
  const k = a === b || at >= b.at ? 1 : Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at || 1)));
  const lerp = (u: number, v: number) => u + (v - u) * k;
  sim.rings.forEach((r, j) => {
    if (j === party.mine && party.predicting) return;
    const sa = a.snap.rings[j];
    const sb = b.snap.rings[j];
    if (!sb) return;
    unpackRing(sb, r);
    if (!sa) return;
    r.x = lerp(sa[0], sb[0]) / 100;
    r.z = lerp(sa[1], sb[1]) / 100;
    r.y = lerp(sa[2], sb[2]) / 100;
    let turn = (sb[5] - sa[5]) % 256;
    if (turn > 128) turn -= 256;
    if (turn < -128) turn += 256;
    r.facing = ((sa[5] + turn * k) / 256) * Math.PI * 2;
  });
  sim.t = lerp(a.snap.t, b.snap.t) / 1000;
  if (b.snap.spin !== undefined) sim.spinner.angle = lerp(a.snap.spin ?? b.snap.spin, b.snap.spin) / 1000;
  if (b.snap.tiles) unpackTiles(b.snap.tiles, sim.tiles, sim.t);
  sim.pickups = unpackPickups(b.snap.pickups ?? [], sim.pickups, sim.t);
  sim.patches = (b.snap.patches ?? []).map(([id, x, z]) => ({ id, x: x / 100, z: z / 100, owner: "", at: 0, until: Infinity }));
  sim.radius = sim.edgeAt(sim.t);
  sim.warning = sim.phase === "play" && sim.edgeAt(sim.t + sim.map.suddenDeath.warnSeconds) < sim.radius;
}
