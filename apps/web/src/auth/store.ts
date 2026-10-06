import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { MeView } from "@shadow/shared";
import { api } from "../api/client";
import { supabase } from "../lib/supabase";
import { savedSessionIds } from "../games/shadow-guess/store";
import { forgetClimbRuns, savedClimbRunIds } from "../games/sky-climb/guest";
import { forgetPuttRounds, savedPuttRoundIds } from "../games/putt-isles/guest";

interface AuthState {
  /** False when Supabase env vars are missing. */
  enabled: boolean;
  user: User | null;
  /** Auth state is known and guest sessions have been claimed; safe to load games. */
  synced: boolean;
  me: MeView | null;
  init: () => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  enabled: supabase !== null,
  user: null,
  synced: supabase === null,
  me: null,

  init: () => {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (get().synced && user?.id === get().user?.id) return; // token refresh
      set({ user, synced: false });
      // Supabase calls inside this callback can deadlock, so defer the follow-up work.
      setTimeout(async () => {
        if (user) {
          // Games played as a guest in this browser move into the account.
          await api("/api/me/claim", { body: { sessionIds: savedSessionIds() } }).catch(() => {});
          const runIds = savedClimbRunIds();
          if (runIds.length) {
            await api("/api/sky-climb/claim", { body: { runIds } }).then(forgetClimbRuns, () => {});
          }
          const roundIds = savedPuttRoundIds();
          if (roundIds.length) {
            await api("/api/putt-isles/claim", { body: { roundIds } }).then(forgetPuttRounds, () => {});
          }
          await get().refreshMe();
        } else {
          set({ me: null });
        }
        set({ synced: true });
      });
    });
    return () => data.subscription.unsubscribe();
  },

  signIn: async () => {
    // Return to the same page, minus any #fragment: a leftover "#" (e.g. from an earlier
    // sign-in) would otherwise come back as "##…" and the callback couldn't be read.
    const { origin, pathname, search } = window.location;
    await supabase?.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}${pathname}${search}` },
    });
  },

  signOut: async () => {
    await supabase?.auth.signOut();
  },

  refreshMe: async () => {
    if (!get().user) return;
    try {
      set({ me: await api<MeView>("/api/me") });
    } catch {
      // Stats are optional; the game still works.
    }
  },
}));
