// Pair Pop's board state: the tiles, which are face up or matched, moves, combo and score.
// The scene animates from this; the HUD reads it. Each game is opened on the server (which
// hands out the shuffle) and finished there with its flips, which the server replays to
// score it; offline, the board still plays and the result is kept in this browser.
import { create } from "zustand";
import {
  PAIR_POP_DAILY_LEVEL,
  PAIR_POP_LEVELS,
  dealPairPop,
  pairPopDailySeed,
  pairPopMatchPoints,
  pairPopResult,
  pairsOf,
  replayPairPop,
  type PairPopCard,
  type PairPopGameView,
  type PairPopLevel,
  type PairPopResultView,
} from "@shadow/shared";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";
import { play } from "../../lib/sound";
import { TIMING } from "./config";
import { dailyNumber, today } from "./deck";
import { rememberDaily, rememberGame, rememberStars, savedDaily } from "./guest";

const BASE = "/api/pair-pop";

export type PairPopMode = { kind: "daily" } | { kind: "level"; level: number };

/**
 * deal: tiles dropping onto the board · peek: every tile shown for a moment · play: your
 * turn · won: the board is cleared.
 */
export type PairPopPhase = "deal" | "peek" | "play" | "won";

export interface PairPopResult {
  moves: number;
  seconds: number;
  score: number;
  stars: number;
  bestCombo: number;
  /** Today's daily was already finished: this game doesn't count. */
  replay: boolean;
  /** saving: on its way to the server · saved: scored there · local: kept in this browser only. */
  saved: "saving" | "saved" | "local";
  /** Daily, signed in: today's rank among the players. */
  rank: number | null;
  players: number;
}

interface PairPopState {
  mode: PairPopMode;
  level: PairPopLevel;
  /** The game on the server; null when it couldn't be reached (the board still plays). */
  game: PairPopGameView | null;
  tiles: PairPopCard[];
  up: boolean[];
  matched: boolean[];
  /** Bumped on a tile when it's part of a wrong pair, to shake it. */
  shakes: number[];
  /** Face-up tiles that aren't matched yet (at most two). */
  open: number[];
  /** Every tile turned, in order: sent to the server to score the game. */
  flips: number[];
  phase: PairPopPhase;
  /** Bumped on every new board, so the scene deals in from scratch. */
  round: number;
  moves: number;
  matches: number;
  combo: number;
  bestCombo: number;
  score: number;
  /** When the first tile was turned (ms), and when the last pair was found. */
  startedAt: number | null;
  endedAt: number | null;
  /** The latest combo of 2+, for the HUD to celebrate. */
  comboPop: { id: number; combo: number; points: number } | null;
  result: PairPopResult | null;
  /** How far the HUD's top bar reaches down the screen (px), so the camera frames the board below it. */
  hudTop: number;

  setMode: (mode: PairPopMode) => void;
  /** Deals a fresh board in the current mode. */
  start: () => Promise<void>;
  /** The scene says the deal-in has landed. */
  dealt: () => void;
  flip: (i: number) => void;
}

let missTimer: ReturnType<typeof setTimeout> | null = null;
let phaseTimer: ReturnType<typeof setTimeout> | null = null;
let popId = 0;
/** Bumped by every start, so a slow reply from an older one is dropped. */
let starting = 0;

const clearTimers = () => {
  if (missTimer) clearTimeout(missTimer);
  if (phaseTimer) clearTimeout(phaseTimer);
  missTimer = phaseTimer = null;
};

const levelOf = (mode: PairPopMode) => (mode.kind === "daily" ? PAIR_POP_DAILY_LEVEL : PAIR_POP_LEVELS[mode.level]);
const randomSeed = () => Math.random().toString(36).slice(2);

export const elapsedSeconds = (s: Pick<PairPopState, "startedAt" | "endedAt">, now = Date.now()) =>
  s.startedAt ? ((s.endedAt ?? now) - s.startedAt) / 1000 : 0;

export const usePairPop = create<PairPopState>((set, get) => {
  /** Turns a wrong pair back over. */
  const hideMiss = () => {
    if (missTimer) clearTimeout(missTimer);
    missTimer = null;
    const { open, up } = get();
    if (open.length < 2) return;
    const next = up.slice();
    for (const i of open) next[i] = false;
    set({ up: next, open: [] });
  };

  const finish = () => {
    const s = get();
    const pairs = pairsOf(s.level);
    const timeMs = (s.endedAt ?? Date.now()) - (s.startedAt ?? Date.now());
    // Scored the same way the server will, so the card doesn't change when it answers.
    const replay = replayPairPop(s.tiles, s.flips);
    const local = replay ? pairPopResult(replay, pairs, timeMs) : { moves: s.moves, bestCombo: s.bestCombo, seconds: timeMs / 1000, score: s.score, stars: 1 };
    const daily = s.mode.kind === "daily";
    // The server knows for accounts; a guest's earlier finish is only in this browser.
    const isReplay = daily && (!!s.game?.replay || !!savedDaily());
    if (daily) rememberDaily({ moves: local.moves, seconds: Math.round(local.seconds), score: local.score, stars: local.stars });
    else if (s.mode.kind === "level") rememberStars(s.mode.level, local.stars);

    set({
      phase: "won",
      score: local.score,
      result: { ...local, replay: isReplay, saved: s.game ? "saving" : "local", rank: null, players: 0 },
    });
    play("win");

    const { game, round } = s;
    if (!game) return;
    api<PairPopResultView>(`${BASE}/games/${game.gameId}/finish`, { body: { flips: s.flips, timeMs } }).then(
      (r) => {
        if (get().round !== round) return;
        set((now) => ({
          score: r.score,
          result: now.result && {
            ...now.result,
            moves: r.moves,
            seconds: r.seconds,
            score: r.score,
            stars: r.stars,
            bestCombo: r.bestCombo,
            replay: daily && (!r.counted || now.result.replay),
            saved: "saved",
            rank: r.rank,
            players: r.players,
          },
        }));
      },
      () => {
        if (get().round === round) set((now) => ({ result: now.result && { ...now.result, saved: "local" } }));
      },
    );
  };

  return {
    mode: { kind: "daily" },
    level: PAIR_POP_DAILY_LEVEL,
    game: null,
    tiles: [],
    up: [],
    matched: [],
    shakes: [],
    open: [],
    flips: [],
    phase: "deal",
    round: 0,
    moves: 0,
    matches: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    startedAt: null,
    endedAt: null,
    comboPop: null,
    result: null,
    hudTop: 120,

    setMode: (mode) => set({ mode }),

    start: async () => {
      clearTimers();
      const token = ++starting;
      const { mode } = get();
      const level = levelOf(mode);
      let game: PairPopGameView | null = null;
      try {
        game = await api<PairPopGameView>(`${BASE}/games`, {
          body: mode.kind === "daily" ? { mode: "daily" } : { mode: "level", level: mode.level },
        });
        if (!useAuth.getState().user) rememberGame(game.gameId);
      } catch {
        // Offline: the board still plays, it just isn't saved to the server.
      }
      if (token !== starting) return;
      const seed = game?.seed ?? (mode.kind === "daily" ? pairPopDailySeed(today()) : `level-${mode.level}:${randomSeed()}`);
      const tiles = dealPairPop(level, seed, game?.layoutSeed ?? randomSeed());
      set((s) => ({
        level,
        game,
        tiles,
        up: tiles.map(() => false),
        matched: tiles.map(() => false),
        shakes: tiles.map(() => 0),
        open: [],
        flips: [],
        phase: "deal",
        round: s.round + 1,
        moves: 0,
        matches: 0,
        combo: 0,
        bestCombo: 0,
        score: 0,
        startedAt: null,
        endedAt: null,
        comboPop: null,
        result: null,
      }));
    },

    dealt: () => {
      const { phase, tiles, level, round } = get();
      if (phase !== "deal") return;
      set({ phase: "peek", up: tiles.map(() => true) });
      play("turn");
      phaseTimer = setTimeout(() => {
        if (get().round !== round) return;
        set({ phase: "play", up: tiles.map(() => false) });
        play("turn");
      }, level.peek * 1000);
    },

    flip: (i) => {
      const s = get();
      if (s.phase !== "play" || s.up[i] || s.matched[i]) return;
      // A wrong pair still showing turns back the moment you pick again.
      if (s.open.length >= 2) hideMiss();
      const { up, open, tiles, flips } = get();
      const nextUp = up.slice();
      nextUp[i] = true;
      const nextOpen = [...open, i];
      set({ up: nextUp, open: nextOpen, flips: [...flips, i], startedAt: s.startedAt ?? Date.now() });
      play("flip");
      if (nextOpen.length < 2) return;

      const [a, b] = nextOpen;
      const moves = s.moves + 1;
      if (tiles[a].pal === tiles[b].pal) {
        const combo = s.combo + 1;
        const points = pairPopMatchPoints(combo);
        set({ moves, open: [], combo, bestCombo: Math.max(s.bestCombo, combo) });
        const round = s.round;
        setTimeout(() => {
          const now = get();
          if (now.round !== round) return;
          const matched = now.matched.slice();
          matched[a] = matched[b] = true;
          const matches = now.matches + 1;
          const done = matches >= pairsOf(now.level);
          set({
            matched,
            matches,
            score: now.score + points,
            endedAt: done ? Date.now() : null,
            comboPop: combo >= 2 ? { id: ++popId, combo, points } : now.comboPop,
          });
          play(combo >= 2 ? "combo" : "pair", Math.min(1, combo / 5));
          if (done) phaseTimer = setTimeout(() => get().round === round && finish(), TIMING.winDelay);
        }, TIMING.matchDelay);
      } else {
        const shakes = s.shakes.slice();
        shakes[a]++;
        shakes[b]++;
        set({ moves, combo: 0, shakes });
        missTimer = setTimeout(hideMiss, TIMING.missHold);
        setTimeout(() => play("nomatch"), 180);
      }
    },
  };
});

export const pairPopTitle = (mode: PairPopMode) => (mode.kind === "daily" ? `Daily #${dailyNumber()}` : `Level ${mode.level + 1}`);
