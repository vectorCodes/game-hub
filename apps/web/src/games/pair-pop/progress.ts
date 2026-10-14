// Today's board on the server (players, and my counted result with its rank) and, signed in,
// my level stars from any device. Server stars are merged into this browser's, so every
// "is this level open?" check keeps reading local storage.
import { create } from "zustand";
import type { PairPopDailyView, PairPopProgressView } from "@shadow/shared";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";
import { rememberDaily, rememberStars } from "./guest";

interface ProgressState {
  daily: PairPopDailyView | null;
  /** Bumped whenever server progress lands, so pages reading local storage re-render. */
  version: number;
  load: () => Promise<void>;
}

let loading: Promise<void> | null = null;

export const usePairPopProgress = create<ProgressState>((set) => ({
  daily: null,
  version: 0,
  load: () => {
    loading ??= (async () => {
      const signedIn = !!useAuth.getState().user;
      const [daily, progress] = await Promise.all([
        api<PairPopDailyView>("/api/pair-pop/daily").catch(() => null),
        signedIn ? api<PairPopProgressView>("/api/pair-pop/progress").catch(() => null) : null,
      ]);
      progress?.stars.forEach((stars, level) => stars > 0 && rememberStars(level, stars));
      if (daily?.mine) rememberDaily({ moves: daily.mine.moves, seconds: daily.mine.seconds, score: daily.mine.score, stars: daily.mine.stars }, daily.date);
      set((s) => ({ daily, version: s.version + 1 }));
    })().finally(() => (loading = null));
    return loading;
  },
}));
