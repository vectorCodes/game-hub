// The Bumper Arena prototype's state: who's playing, the round in progress (its sim and bot
// brains live outside React, in `game`), and the bits of it the HUD shows.
import { create } from "zustand";
import {
  AVATAR_STYLES,
  BOT_NAMES,
  BotBrain,
  BUMPER_MAPS,
  BUMPER_TUNING,
  BumperSim,
  HAIR_COLORS,
  makeRng,
  OUTFIT_COLORS,
  SKIN_TONES,
  type AvatarConfig,
  type BotLevel,
  type BumperEvent,
  type BumperPhase,
  type BumperTuning,
  type RingState,
} from "@shadow/shared";

export const ME = "me";

/** One per seat; the player's is the first. */
export const RING_COLORS = ["#e8574a", "#4f8fe0", "#f2b33d", "#4cb681", "#a878e8", "#f378c8", "#3fc1c9", "#ff8a3d", "#8a8f9e", "#c9e04f"];

/** Live-tunable copy of the ring tuning (the prototype's tuning panel edits it in place). */
export const tuning: BumperTuning = { ...BUMPER_TUNING };

export interface Entrant {
  id: string;
  name: string;
  bot: boolean;
  /** Null for the player: their own saved avatar is used. */
  avatar: AvatarConfig | null;
  color: string;
}

/** The round being played. Mutable and outside React: the frame loop steps it. */
export const game: { sim: BumperSim | null; brains: BotBrain[] } = { sim: null, brains: [] };

function botAvatar(i: number): AvatarConfig {
  const rng = makeRng(`bumper-bot:${i}`);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
  return {
    head: pick(AVATAR_STYLES),
    body: pick(AVATAR_STYLES),
    skin: pick(SKIN_TONES).id,
    hair: pick(HAIR_COLORS).id,
    top: pick(OUTFIT_COLORS).id,
    bottom: pick(OUTFIT_COLORS).id,
    shoes: pick(OUTFIT_COLORS).id,
    hat: "hat:none",
    eyewear: "eyewear:none",
  };
}

function entrantsFor(bots: number): Entrant[] {
  return [
    { id: ME, name: "You", bot: false, avatar: null, color: RING_COLORS[0] },
    ...Array.from({ length: bots }, (_, i) => ({ id: `bot${i}`, name: BOT_NAMES[i], bot: true, avatar: botAvatar(i), color: RING_COLORS[i + 1] })),
  ];
}

export interface FeedLine {
  id: number;
  text: string;
}

interface State {
  bots: number;
  level: BotLevel;
  entrants: Entrant[];
  /** Bumped for every new round; the scene remounts its riders on it. */
  round: number;
  phase: BumperPhase;
  t: number;
  alive: number;
  edgeWarning: boolean;
  wobble: number;
  /** 0–1, 1 = ready. */
  dashReady: number;
  braceReady: number;
  myState: RingState;
  winner: string | null;
  wins: Record<string, number>;
  feed: FeedLine[];
  showTuning: boolean;
  setBots: (n: number) => void;
  setLevel: (level: BotLevel) => void;
  /** Starts a new round with the current setup. */
  next: () => void;
  toggleTuning: () => void;
}

let feedId = 0;

export const useBumper = create<State>((set, get) => ({
  bots: 3,
  level: "easy",
  entrants: entrantsFor(3),
  round: 0,
  phase: "countdown",
  t: 0,
  alive: 0,
  edgeWarning: false,
  wobble: 0,
  dashReady: 1,
  braceReady: 1,
  myState: "in",
  winner: null,
  wins: {},
  feed: [],
  showTuning: false,

  setBots: (bots) => set({ bots, entrants: entrantsFor(bots), wins: {} }),
  setLevel: (level) => set({ level, wins: {} }),
  toggleTuning: () => set((s) => ({ showTuning: !s.showTuning })),

  next: () => {
    const { entrants, level, round } = get();
    const seed = `round:${round + 1}`;
    game.sim = new BumperSim(BUMPER_MAPS["picnic-plate"], entrants, tuning);
    game.brains = entrants.filter((e) => e.bot).map((e) => new BotBrain(e.id, level, seed));
    set({ round: round + 1, phase: "countdown", winner: null, feed: [], alive: entrants.length, wobble: 0, myState: "in", edgeWarning: false });
  },
}));

const nameOf = (id: string) => useBumper.getState().entrants.find((e) => e.id === id)?.name ?? id;

/** Keeps the HUD's copy of the round in step; called by the frame loop. */
export function syncHud(sim: BumperSim) {
  const me = sim.ring(ME);
  const s = useBumper.getState();
  const next = {
    phase: sim.phase,
    t: Math.round(sim.t * 10) / 10,
    alive: sim.alive().length,
    edgeWarning: sim.warning,
    wobble: Math.round(me?.wobble ?? 0),
    dashReady: me ? Math.round((1 - me.dashCooldown / tuning.dashCooldown) * 20) / 20 : 0,
    braceReady: me ? (me.bracing ? 0 : Math.round((1 - me.braceCooldown / tuning.braceCooldown) * 20) / 20) : 0,
    myState: me?.state ?? "out",
  };
  if ((Object.keys(next) as (keyof typeof next)[]).some((k) => next[k] !== s[k])) useBumper.setState(next);
}

/** What the HUD makes of the sim's events: the kill feed and the round's winner. */
export function hudEvent(e: BumperEvent) {
  const push = (text: string) => useBumper.setState((s) => ({ feed: [...s.feed.slice(-3), { id: ++feedId, text }] }));
  if (e.type === "out") push(e.by ? `${nameOf(e.by)} bumped ${nameOf(e.id)} out` : `${nameOf(e.id)} fell off`);
  if (e.type === "over") {
    useBumper.setState((s) => ({
      winner: e.winner,
      wins: e.winner ? { ...s.wins, [e.winner]: (s.wins[e.winner] ?? 0) + 1 } : s.wins,
    }));
  }
}

// Effects (puffs, shakes, sounds) listen to the sim's events too.
type Listener = (e: BumperEvent, sim: BumperSim) => void;
const listeners = new Set<Listener>();

export function onBumperEvent(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function emitBumperEvent(e: BumperEvent, sim: BumperSim) {
  hudEvent(e);
  for (const l of listeners) l(e, sim);
}
