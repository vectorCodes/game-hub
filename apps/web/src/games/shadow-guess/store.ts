import { create } from "zustand";
import type { GameMode, GuessResponse, GuessResult, SessionView } from "@shadow/shared";
import { ApiError, api } from "../../api/client";

const BASE = "/api/shadow-guess";
const storageKey = (mode: GameMode) => `shadow-guess:session:${mode}`;

interface SavedSession {
  id: string;
  /** UTC day the session started; a daily session only resumes on the same day. */
  date: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function remember(mode: GameMode, id: string) {
  try {
    localStorage.setItem(storageKey(mode), JSON.stringify({ id, date: today() } satisfies SavedSession));
  } catch {
    // Storage unavailable (private mode): resuming just won't work.
  }
}

function recall(mode: GameMode): SavedSession | null {
  try {
    return JSON.parse(localStorage.getItem(storageKey(mode)) ?? "null");
  } catch {
    return null;
  }
}

/** This browser's guest session for today's daily, if any (for the hub card). */
export function savedDailySessionId(): string | null {
  const saved = recall("daily");
  return saved && saved.date === today() ? saved.id : null;
}

const SOLVED_KEY = "shadow-guess:solved";
/** Enough for the whole catalog several times over; the API takes up to 500. */
const MAX_SOLVED = 500;

/** Rounds this browser has won, so a guest's album survives (newest last). */
export function solvedSessionIds(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(SOLVED_KEY) ?? "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function rememberSolved(id: string) {
  try {
    const ids = solvedSessionIds().filter((x) => x !== id);
    localStorage.setItem(SOLVED_KEY, JSON.stringify([...ids, id].slice(-MAX_SOLVED)));
  } catch {
    // Storage unavailable: the album only keeps signed-in wins.
  }
}

/** Session ids this browser has played, for claiming them after sign-in. */
export function savedSessionIds(): string[] {
  return (["daily", "free"] as const).flatMap((mode) => recall(mode)?.id ?? []);
}

/** "close" is a wrong guess that was near the answer. */
export type SubmitResult = GuessResult | "close" | "error";

interface GameState {
  mode: GameMode;
  session: SessionView | null;
  loading: boolean;
  error: string | null;
  names: string[];
  /** Resumes the saved session for `mode` if there is one, otherwise starts a new one. */
  open: (mode: GameMode) => Promise<void>;
  /** Starts a fresh free-play round. */
  next: () => Promise<void>;
  submitGuess: (text: string) => Promise<SubmitResult>;
  skip: () => Promise<void>;
  useHint: () => Promise<void>;
  loadNames: () => Promise<void>;
}

export const useShadowGame = create<GameState>((set, get) => {
  /** Runs a request that returns the updated session; surfaces failures as `error`. */
  async function update(request: () => Promise<SessionView>) {
    try {
      set({ session: await request(), error: null });
    } catch (e) {
      set({ error: e instanceof ApiError ? e.code : "network_error" });
    }
  }

  async function startNew(mode: GameMode, previousSessionId?: string) {
    const session = await api<SessionView>(`${BASE}/sessions`, { body: { mode, previousSessionId } });
    remember(mode, session.sessionId);
    return session;
  }

  return {
    mode: "daily",
    session: null,
    loading: false,
    error: null,
    names: [],

    open: async (mode) => {
      if (get().loading && get().mode === mode) return; // StrictMode double-invoke
      set({ mode, loading: true, error: null, session: null });
      try {
        let session: SessionView | null = null;
        let previous: string | undefined;
        const saved = recall(mode);
        // Yesterday's daily is replaced by today's; a finished free round moves on (a
        // solved one keeps its run going).
        if (saved && (mode === "free" || saved.date === today())) {
          session = await api<SessionView>(`${BASE}/sessions/${saved.id}`).catch(() => null);
          if (session && mode === "free" && session.status !== "playing") {
            previous = session.sessionId;
            session = null;
          }
        }
        session ??= await startNew(mode, previous);
        if (get().mode === mode) set({ session });
      } catch (e) {
        set({ error: e instanceof ApiError ? e.code : "network_error" });
      } finally {
        set({ loading: false });
      }
    },

    next: async () => {
      const previous = get().session?.sessionId;
      set({ mode: "free", loading: true, error: null });
      await update(() => startNew("free", previous));
      set({ loading: false });
    },

    submitGuess: async (text) => {
      const session = get().session;
      if (!session) return "error";
      try {
        const res = await api<GuessResponse>(`${BASE}/sessions/${session.sessionId}/guess`, {
          body: { text },
        });
        set({ session: res.session, error: null });
        if (res.result === "correct") rememberSolved(res.session.sessionId);
        return res.close ? "close" : res.result;
      } catch (e) {
        set({ error: e instanceof ApiError ? e.code : "network_error" });
        return "error";
      }
    },

    skip: async () => {
      const id = get().session?.sessionId;
      if (id) await update(() => api<SessionView>(`${BASE}/sessions/${id}/skip`, { method: "POST" }));
    },

    useHint: async () => {
      const id = get().session?.sessionId;
      if (id) await update(() => api<SessionView>(`${BASE}/sessions/${id}/hint`, { method: "POST" }));
    },

    loadNames: async () => {
      if (get().names.length) return;
      try {
        set({ names: await api<string[]>(`${BASE}/objects/names`) });
      } catch {
        // Autocomplete is optional.
      }
    },
  };
});
