// A signed-in player's Bumper Arena progress from the API: level and XP, the party record and
// the best Gauntlet run. Loaded on sign-in and again after each party match; guests have none.
import { create } from "zustand";
import type { BumperProgress } from "@shadow/shared";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";

export const useBumperProgress = create<{ progress: BumperProgress | null; load: () => Promise<void> }>((set) => ({
  progress: null,
  load: async () => {
    if (!useAuth.getState().user) return set({ progress: null });
    try {
      set({ progress: await api<BumperProgress>("/api/bumper-arena/progress") });
    } catch {
      // Offline: keep what we had.
    }
  },
}));
