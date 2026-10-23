// Bumper Arena's state: the mode (the menu, with bots playing behind it; Practice; the Daily
// Gauntlet), who's in the round, the round's sim and bot brains (outside React, in `game`),
// and the bits of it the HUD shows. A Gauntlet run is opened on the server, which says what
// today's arena and twist are, and finished there with how far it got; offline, it still
// plays and the result is kept in this browser.
import { create } from "zustand";
import {
  AVATAR_STYLES,
  BOT_NAMES,
  BotBrain,
  BUMPER_MAPS,
  BUMPER_TUNING,
  BUMPER_WAVE_WOBBLE_CARRY,
  BumperSim,
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
  bumperDay,
  bumperScore,
  bumperWave,
  makeRng,
  withModifier,
  type AvatarConfig,
  type BotLevel,
  type BumperDailyView,
  type BumperDay,
  type BumperEvent,
  type BumperPhase,
  type BumperResultView,
  type BumperRunView,
  type BumperTuning,
  type RingState,
} from "@shadow/shared";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";
import { track } from "../../lib/analytics";
import { rememberDaily, rememberRun, savedDaily, today } from "./guest";

const BASE = "/api/bumper-arena";

export const ME = "me";

/** One per seat; the player's is the first. */
export const RING_COLORS = ["#e8574a", "#4f8fe0", "#f2b33d", "#4cb681", "#a878e8", "#f378c8", "#3fc1c9", "#ff8a3d", "#8a8f9e", "#c9e04f"];

/** Live-tunable copy of the ring tuning (the dev tuning panel edits it in place). */
export const tuning: BumperTuning = { ...BUMPER_TUNING };

export interface Entrant {
  id: string;
  name: string;
  bot: boolean;
  /** Null for the player: their own saved avatar is used. */
  avatar: AvatarConfig | null;
  color: string;
  /** A bot's skill. */
  level: BotLevel | null;
}

/** The round being played. Mutable and outside React: the frame loop steps it. */
export const game: { sim: BumperSim | null; brains: BotBrain[] } = {
  sim: null,
  brains: [],
};

export type BumperMode = "menu" | "practice" | "gauntlet";

export interface PracticeSetup {
  map: string;
  bots: number;
  level: BotLevel;
}

export interface GauntletRunResult {
  waves: number;
  kos: number;
  score: number;
  peakWobble: number;
  seconds: number;
  /** Today's Gauntlet was already finished: this run doesn't count. */
  replay: boolean;
  /** saving: on its way to the server · saved: recorded there · local: kept in this browser only. */
  saved: "saving" | "saved" | "local";
  rank: number | null;
  players: number;
}

export interface GauntletState {
  day: BumperDay;
  /** The wave being fought (1-based). */
  wave: number;
  cleared: number;
  kos: number;
  peakWobble: number;
  startedAt: number;
  /** The run on the server; null when it couldn't be reached. */
  run: BumperRunView | null;
  /** fighting a wave · cleared: a moment between waves · out: the run is over. */
  status: "fighting" | "cleared" | "out";
  result: GauntletRunResult | null;
}

function botAvatar(i: number): AvatarConfig {
  const rng = makeRng(`bumper-bot:${i}`);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)];
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

const bot = (i: number, level: BotLevel): Entrant => ({
  id: `bot${i}`,
  name: BOT_NAMES[i % BOT_NAMES.length],
  bot: true,
  avatar: botAvatar(i),
  color: RING_COLORS[(i + 1) % RING_COLORS.length],
  level,
});

const you = (): Entrant => ({
  id: ME,
  name: "You",
  bot: false,
  avatar: null,
  color: RING_COLORS[0],
  level: null,
});

export interface FeedLine {
  id: number;
  text: string;
}

interface State {
  mode: BumperMode;
  practice: PracticeSetup;
  gauntlet: GauntletState | null;
  /** Today's Gauntlet as the server sees it (players, my run), for the menu. */
  daily: BumperDailyView | null;
  entrants: Entrant[];
  /** Bumped for every new round. */
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
  /** Practice: rounds won this session. */
  wins: Record<string, number>;
  feed: FeedLine[];
  showTuning: boolean;

  /** The menu, with a bots-only round playing behind it. */
  openMenu: () => void;
  startPractice: (setup?: Partial<PracticeSetup>) => void;
  startGauntlet: () => void;
  /** Practice: the next round. The menu: the next bots-only round. */
  next: () => void;
  setPractice: (setup: Partial<PracticeSetup>) => void;
  loadDaily: () => Promise<void>;
  toggleTuning: () => void;
}

let feedId = 0;
/** Bumped by every new run or mode, so slow server replies and timers from an old one are dropped. */
let epoch = 0;

/** Puts a fresh round in `game`: these entrants on this map. */
function stage(entrants: Entrant[], map: string, rules: BumperTuning, seed: string) {
  game.sim = new BumperSim(BUMPER_MAPS[map] ?? BUMPER_MAPS["picnic-plate"], entrants, rules);
  game.brains = entrants.filter((e) => e.bot).map((e) => new BotBrain(e.id, e.level ?? "easy", seed));
}

const fresh = {
  phase: "countdown" as BumperPhase,
  winner: null,
  feed: [],
  wobble: 0,
  myState: "in" as RingState,
  edgeWarning: false,
};

export const useBumper = create<State>((set, get) => ({
  mode: "menu",
  practice: { map: "picnic-plate", bots: 3, level: "easy" },
  gauntlet: null,
  daily: null,
  entrants: [],
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

  openMenu: () => {
    epoch++;
    set({ mode: "menu", gauntlet: null, wins: {} });
    get().next();
  },

  startPractice: (setup) => {
    epoch++;
    const practice = { ...get().practice, ...setup };
    set({ mode: "practice", practice, gauntlet: null, wins: {} });
    get().next();
    track("game_started", {
      game: "bumper-arena",
      mode: "practice",
      map: practice.map,
      bots: practice.bots,
      level: practice.level,
    });
  },

  startGauntlet: () => {
    const mine = ++epoch;
    const g: GauntletState = {
      day: bumperDay(today()),
      wave: 1,
      cleared: 0,
      kos: 0,
      peakWobble: 0,
      startedAt: Date.now(),
      run: null,
      status: "fighting",
      result: null,
    };
    set({ mode: "gauntlet", wins: {} });
    beginWave(g, 0);
    track("game_started", {
      game: "bumper-arena",
      mode: "gauntlet",
      map: g.day.map,
      modifier: g.day.modifier,
    });
    api<BumperRunView>(`${BASE}/runs`, { body: {} }).then(
      (run) => {
        if (epoch !== mine) return;
        if (!useAuth.getState().user) rememberRun(run.runId);
        const now = get().gauntlet;
        // A run that started just before midnight keeps the arena it started on.
        if (now && run.day.date === now.day.date) set({ gauntlet: { ...now, run } });
      },
      () => {},
    );
  },

  next: () => {
    const { mode, practice, round } = get();
    if (mode === "gauntlet") return;
    // The menu's backdrop: a bots-only round on Picnic Plate.
    const entrants =
      mode === "practice"
        ? [you(), ...Array.from({ length: practice.bots }, (_, i) => bot(i, practice.level))]
        : Array.from({ length: 5 }, (_, i) => bot(i, "normal"));
    stage(entrants, mode === "practice" ? practice.map : "picnic-plate", tuning, `round:${round + 1}`);
    set({ ...fresh, entrants, round: round + 1, alive: entrants.length });
  },

  setPractice: (setup) => set((s) => ({ practice: { ...s.practice, ...setup }, wins: {} })),

  loadDaily: async () => {
    try {
      set({ daily: await api<BumperDailyView>(`${BASE}/daily`) });
    } catch {
      // Offline: the menu shows today's arena from the date alone.
    }
  },

  toggleTuning: () => set((s) => ({ showTuning: !s.showTuning })),
}));

/** Stages wave `g.wave` of a run: you (carrying some Wobble) against its bots. */
function beginWave(g: GauntletState, carry: number) {
  const entrants = [you(), ...bumperWave(g.wave).map((level, i) => bot(i, level))];
  stage(entrants, g.day.map, withModifier(tuning, g.day.modifier), `${g.day.date}:wave:${g.wave}`);
  const me = game.sim?.ring(ME);
  if (me) me.wobble = carry;
  useBumper.setState((s) => ({
    ...fresh,
    entrants,
    round: s.round + 1,
    alive: entrants.length,
    gauntlet: { ...g, status: "fighting" },
  }));
}

/** You went over the edge: the run ends, is kept here and recorded on the server. */
function finishRun() {
  const g = useBumper.getState().gauntlet;
  if (!g || g.status === "out") return;
  const seconds = (Date.now() - g.startedAt) / 1000;
  const score = bumperScore(g.cleared, g.kos);
  // The server knows for accounts; a guest's earlier run is only in this browser.
  const replay = !!g.run?.replay || !!savedDaily(g.day.date);
  rememberDaily(
    {
      waves: g.cleared,
      kos: g.kos,
      score,
      peakWobble: Math.round(g.peakWobble),
    },
    g.day.date,
  );
  const result: GauntletRunResult = {
    waves: g.cleared,
    kos: g.kos,
    score,
    peakWobble: Math.round(g.peakWobble),
    seconds,
    replay,
    saved: g.run ? "saving" : "local",
    rank: null,
    players: 0,
  };
  useBumper.setState({ gauntlet: { ...g, status: "out", result } });
  track("game_finished", {
    game: "bumper-arena",
    mode: "gauntlet",
    waves: g.cleared,
    kos: g.kos,
    score,
    seconds: Math.round(seconds),
    replay,
  });

  if (!g.run) return;
  const mine = epoch;
  api<BumperResultView>(`${BASE}/runs/${g.run.runId}/finish`, {
    body: {
      waves: g.cleared,
      kos: g.kos,
      peakWobble: Math.round(g.peakWobble),
      timeMs: Math.round(seconds * 1000),
    },
  }).then(
    (r) => {
      if (epoch !== mine) return;
      const now = useBumper.getState().gauntlet;
      if (!now?.result) return;
      useBumper.setState({
        gauntlet: {
          ...now,
          result: {
            ...now.result,
            score: r.score,
            saved: "saved",
            rank: r.rank,
            players: r.players,
            replay: now.result.replay || !r.counted,
          },
        },
      });
      void useBumper.getState().loadDaily();
    },
    () => {
      if (epoch !== mine) return;
      const now = useBumper.getState().gauntlet;
      if (now?.result)
        useBumper.setState({
          gauntlet: { ...now, result: { ...now.result, saved: "local" } },
        });
    },
  );
}

/** The Gauntlet's reactions to the sim: knockouts, going out, clearing a wave. */
function gauntletEvent(e: BumperEvent) {
  const s = useBumper.getState();
  const g = s.gauntlet;
  if (s.mode !== "gauntlet" || !g || g.status !== "fighting") return;
  if (e.type === "out" && e.by === ME) useBumper.setState({ gauntlet: { ...g, kos: g.kos + 1 } });
  if (e.type === "fall" && e.id === ME) finishRun();
  if (e.type === "over" && e.winner === ME) {
    const cleared = {
      ...g,
      cleared: g.cleared + 1,
      status: "cleared" as const,
    };
    useBumper.setState({ gauntlet: cleared });
    const mine = epoch;
    setTimeout(() => {
      if (epoch !== mine) return;
      const now = useBumper.getState().gauntlet;
      if (!now || now.status !== "cleared") return;
      const carry = (game.sim?.ring(ME)?.wobble ?? 0) * BUMPER_WAVE_WOBBLE_CARRY;
      beginWave({ ...now, wave: now.wave + 1 }, carry);
    }, 2400);
  }
}

/** Practice and menu reactions: the winner, the score, the menu's endless backdrop. */
function roundEvent(e: BumperEvent) {
  if (e.type !== "over") return;
  const { mode } = useBumper.getState();
  useBumper.setState((s) => ({
    winner: e.winner,
    wins: mode === "practice" && e.winner ? { ...s.wins, [e.winner]: (s.wins[e.winner] ?? 0) + 1 } : s.wins,
  }));
  if (mode === "menu") {
    const mine = epoch;
    setTimeout(() => epoch === mine && useBumper.getState().mode === "menu" && useBumper.getState().next(), 2500);
  }
}

const nameOf = (id: string) => useBumper.getState().entrants.find((e) => e.id === id)?.name ?? id;

/** Keeps the HUD's copy of the round in step; called by the frame loop. */
export function syncHud(sim: BumperSim) {
  const me = sim.ring(ME);
  const s = useBumper.getState();
  const k = sim.tuning;
  const next = {
    phase: sim.phase,
    t: Math.round(sim.t * 10) / 10,
    alive: sim.alive().length,
    edgeWarning: sim.warning,
    wobble: Math.round(me?.wobble ?? 0),
    dashReady: me ? Math.round((1 - me.dashCooldown / k.dashCooldown) * 20) / 20 : 0,
    braceReady: me && k.braceMaxSeconds > 0 ? (me.bracing ? 0 : Math.round((1 - me.braceCooldown / k.braceCooldown) * 20) / 20) : 0,
    myState: me?.state ?? "out",
  };
  if ((Object.keys(next) as (keyof typeof next)[]).some((key) => next[key] !== s[key])) useBumper.setState(next);
  const g = s.gauntlet;
  if (g && me?.state === "in" && me.wobble > g.peakWobble + 0.5) useBumper.setState({ gauntlet: { ...g, peakWobble: me.wobble } });
}

/** What the HUD makes of the sim's events: the kill feed, the round's end, the Gauntlet. */
function hudEvent(e: BumperEvent) {
  const push = (text: string) =>
    useBumper.setState((s) => ({
      feed: [...s.feed.slice(-3), { id: ++feedId, text }],
    }));
  if (e.type === "out" && useBumper.getState().mode !== "menu")
    push(e.by ? `${nameOf(e.by)} bumped ${nameOf(e.id)} out` : `${nameOf(e.id)} fell off`);
  roundEvent(e);
  gauntletEvent(e);
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
