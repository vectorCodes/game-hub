// Your Prop Hunt level and taunts (signed in only; guests have the starter taunts), and the XP
// the last match earned, as the room reports it once the API has saved it.
import { useEffect } from "react";
import { create } from "zustand";
import { HUNT_STARTER_TAUNTS, type HuntProgress, type HuntTauntId, type HuntXpGain } from "@shadow/shared";
import { api } from "../../api/client";
import { useAuth } from "../../auth/store";
import { onHuntMessage } from "./room";

interface State {
  progress: HuntProgress | null;
  /** The last match: undefined while waiting (or not signed in), null if it couldn't be saved. */
  gain: HuntXpGain | null | undefined;
  load: () => Promise<void>;
  /** Resolves to an error code, or null when saved. */
  pick: (taunts: HuntTauntId[]) => Promise<string | null>;
}

export const useHuntProgress = create<State>((set, get) => ({
  progress: null,
  gain: undefined,
  load: async () => {
    if (!useAuth.getState().user) return set({ progress: null });
    try {
      set({ progress: await api<HuntProgress>("/api/hunt/progress") });
    } catch {
      // The API is unreachable: play with the starter taunts.
    }
  },
  pick: async (taunts) => {
    const before = get().progress;
    if (!before) return "sign_in_required";
    // At once on screen; put back if the API says no.
    set({ progress: { ...before, taunts } });
    try {
      set({ progress: await api<HuntProgress>("/api/hunt/loadout", { body: { taunts } }) });
      return null;
    } catch (e) {
      set({ progress: before });
      return e instanceof Error ? e.message : "request_failed";
    }
  },
}));

/** The taunts you play: yours if signed in, otherwise the starter set. */
export const myTaunts = (): HuntTauntId[] => useHuntProgress.getState().progress?.taunts ?? HUNT_STARTER_TAUNTS;

/** A taunt to play now: your one, or one of yours at random. */
export function pickTaunt(): HuntTauntId {
  const taunts = myTaunts();
  return taunts[Math.floor(Math.random() * taunts.length)];
}

onHuntMessage((msg) => {
  if (msg.type === "xp") {
    useHuntProgress.setState({ gain: msg.gain });
    // The level (and what it unlocks) changed: fetch it fresh.
    if (msg.gain) void useHuntProgress.getState().load();
  }
  if (msg.type === "room" && msg.room.status === "countdown") useHuntProgress.setState({ gain: undefined });
});

/** Loads your progress, and again whenever you sign in or out. */
export function useLoadHuntProgress() {
  const userId = useAuth((s) => s.user?.id ?? null);
  const synced = useAuth((s) => s.synced);
  useEffect(() => {
    if (synced) void useHuntProgress.getState().load();
  }, [userId, synced]);
}
