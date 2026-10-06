// Putt Isles' round state: the course, which hole, the strokes on it, and what the ball is
// doing. The physics lives in the scene; this is what the HUD shows, and what's reported
// to the server hole by hole.
import { create } from "zustand";
import {
  generatePuttCourse,
  puttCourseNumber,
  puttDailySeed,
  puttPracticeSeed,
  PUTT_MAX_STROKES,
  type PuttDailyView,
  type PuttMode,
  type PuttRoundView,
} from "@shadow/shared";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";
import { buildHole, type HoleLayout } from "./course";
import { rememberDailyResult, rememberDailyRound, rememberPuttRound, savedDailyRound, today } from "./guest";

const BASE = "/api/putt-isles";

/**
 * loading: getting the round · aim: waiting for a shot · rolling: the ball is moving ·
 * out: it left the course (back in a moment) · sunk: in the cup, or picked up · done: the
 * round is over.
 */
export type PuttPhase = "loading" | "aim" | "rolling" | "out" | "sunk" | "done";

export interface PuttToast {
  id: number;
  title: string;
  subtitle?: string;
}

export const holesFor = (seed: string): HoleLayout[] => generatePuttCourse(seed).map(buildHole);

interface PuttState {
  mode: PuttMode;
  seed: string;
  /** The daily course's number (#12), or null in practice. */
  number: number | null;
  /** The round on the server; null when it couldn't be reached (the round still plays). */
  round: PuttRoundView | null;
  holes: HoleLayout[];
  holeIndex: number;
  strokes: number;
  /** Strokes on each finished hole. */
  scores: number[];
  phase: PuttPhase;
  /** Whether the last hole ended by running out of strokes. */
  pickedUp: boolean;
  /** Bumped to rebuild the hole from scratch. */
  attempt: number;
  overview: boolean;
  toast: PuttToast | null;
  daily: PuttDailyView | null;

  setMode: (mode: PuttMode) => void;
  /** Starts (or picks back up) a round in the current mode. */
  begin: () => Promise<void>;
  shot: () => void;
  rest: () => void;
  out: () => void;
  backIn: () => void;
  sink: () => void;
  nextHole: () => void;
  setOverview: (on: boolean) => void;
  showToast: (t: Omit<PuttToast, "id">) => void;
  loadDaily: () => Promise<void>;
}

let toastId = 0;
let beginning: Promise<void> | null = null;

const dailyDefaults = () => {
  const seed = puttDailySeed(today());
  return { seed, number: puttCourseNumber(today()), holes: holesFor(seed) };
};

export const usePutt = create<PuttState>((set, get) => ({
  mode: "daily",
  ...dailyDefaults(),
  round: null,
  holeIndex: 0,
  strokes: 0,
  scores: [],
  phase: "loading",
  pickedUp: false,
  attempt: 0,
  overview: false,
  toast: null,
  daily: null,

  setMode: (mode) => set({ mode }),

  begin: () => {
    beginning ??= (async () => {
      const { mode } = get();
      set({ phase: "loading", toast: null, overview: false });
      let round: PuttRoundView | null = null;
      try {
        const signedIn = !!useAuth.getState().user;
        round = await api<PuttRoundView>(`${BASE}/rounds`, {
          body: { mode, resume: mode === "daily" && !signedIn ? (savedDailyRound() ?? undefined) : undefined },
        });
        if (!signedIn) rememberPuttRound(round.roundId);
        if (mode === "daily") rememberDailyRound(round.roundId);
      } catch {
        // Offline: today's course (or a random one) still plays, it just isn't recorded.
      }
      const seed = round?.seed ?? (mode === "daily" ? puttDailySeed(today()) : puttPracticeSeed(Math.random().toString(36).slice(2)));
      const scores = round?.strokes ?? [];
      const holes = holesFor(seed);
      const done = scores.length >= holes.length;
      set((s) => ({
        seed,
        number: mode === "daily" ? puttCourseNumber(round?.date ?? today()) : null,
        round,
        holes,
        scores,
        holeIndex: Math.min(scores.length, holes.length - 1),
        strokes: done ? scores[holes.length - 1] : 0,
        phase: done ? "done" : "aim",
        pickedUp: false,
        attempt: s.attempt + 1,
      }));
    })().finally(() => (beginning = null));
    return beginning;
  },

  shot: () => set((s) => ({ strokes: s.strokes + 1, phase: "rolling", overview: false })),

  // Out of strokes: the hole is picked up at the limit.
  rest: () => {
    if (get().strokes >= PUTT_MAX_STROKES) return get().sink();
    set({ phase: "aim" });
  },

  // Off the course costs a stroke; the ball comes back where it was hit from.
  out: () => {
    set((s) => ({ phase: "out", strokes: Math.min(PUTT_MAX_STROKES, s.strokes + 1) }));
    get().showToast({ title: "Out of bounds", subtitle: "+1 stroke" });
  },

  backIn: () => {
    if (get().phase !== "out") return;
    get().rest();
  },

  sink: () => {
    const { strokes, scores, holeIndex, round, mode, phase } = get();
    const next = scores.slice(0, holeIndex);
    next[holeIndex] = strokes;
    set({ phase: "sunk", scores: next, pickedUp: phase !== "rolling" });
    if (mode === "daily") rememberDailyResult(next);
    if (round) {
      api<PuttRoundView>(`${BASE}/rounds/${round.roundId}/holes`, { body: { hole: holeIndex, strokes } }).then(
        (r) => {
          if (get().round?.roundId === r.roundId) set({ round: r });
          if (r.status === "finished" && mode === "daily") void get().loadDaily();
        },
        () => {},
      );
    }
  },

  nextHole: () => {
    const { holeIndex, holes } = get();
    if (holeIndex + 1 >= holes.length) return set({ phase: "done" });
    set({ holeIndex: holeIndex + 1, strokes: 0, phase: "aim", pickedUp: false, overview: false, toast: null });
  },

  setOverview: (on) => set({ overview: on }),

  showToast: (t) => set({ toast: { ...t, id: ++toastId } }),

  loadDaily: async () => {
    try {
      set({ daily: await api<PuttDailyView>(`${BASE}/daily`) });
    } catch {
      // Offline: the landing page manages without the board.
    }
  },
}));
