import { create } from "zustand";
import {
  climbItem,
  decodeGhost,
  encodeGhost,
  practiceSeed,
  TWISTS,
  type AvatarConfig,
  type ClimbChallengeView,
  type ClimbDailyView,
  type ClimbGhostView,
  type ClimbMode,
  type ClimbProfileView,
  type ClimbRunView,
  type GhostFrame,
} from "@shadow/shared";
import { ApiError, api } from "../../api/client";
import { useAuth } from "../../auth/store";
import { useAvatar } from "../../avatar/store";
import { CHARACTERS, FLOORS, zoneIndexOf, type CharacterId } from "./config";
import { keepLocalGhost, localGhost, recordedFrames, resetRecording } from "./ghosts";
import { guestProfile, recordGuestClimb, rememberClimbRun, saveGuestLoadout } from "./guest";
import { sendRoomFinish, sendRoomProgress } from "./room";
import { towerTwist } from "./twists";

const BASE = "/api/sky-climb";

export type Phase = "menu" | "starting" | "countdown" | "playing" | "summit" | "over";

/** A room's race: the tower everyone climbs, and when (on this browser's clock). */
export interface Race {
  seed: string;
  startAt: number;
  endsAt: number;
}

export interface Toast {
  id: number;
  title: string;
  subtitle?: string;
  tone: "zone" | "checkpoint" | "best" | "powerup" | "twist" | "event";
}

export const today = () => new Date().toISOString().slice(0, 10);
/** Must match the server's daily seed, so offline play still climbs today's tower. */
export const dailySeed = () => `daily-${today()}`;

const bestKey = (mode: ClimbMode) => (mode === "daily" ? `sky-climb:best:${today()}` : "sky-climb:best:practice");

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable: the best lasts for this page view.
  }
}

/** This browser's best floor today (or in practice), signed in or not. */
export const localBest = (mode: ClimbMode) => readNumber(bestKey(mode));

/** "character:male-a" → "male-a" (the model to load). */
function characterOf(profile: ClimbProfileView): CharacterId {
  const key = profile.loadout.character.replace("character:", "");
  return (CHARACTERS as readonly string[]).includes(key) ? (key as CharacterId) : CHARACTERS[0];
}

const signedIn = () => useAuth.getState().user !== null;

/** A climb to race, decoded. */
export interface Ghost {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  floor: number;
  seconds: number;
  isMe: boolean;
  /** The challenge link's climb. */
  challenge: boolean;
  frames: GhostFrame[];
}

function toGhost(v: ClimbGhostView, challenge = false): Ghost | null {
  const frames = decodeGhost(v.ghost);
  return frames?.length ? { id: v.runId, name: v.name, avatar: v.avatar, floor: v.floor, seconds: v.seconds, isMe: v.isMe, challenge, frames } : null;
}

const SETTINGS_KEY = "sky-climb:others";

function readSettings(): { ghosts: boolean; live: boolean } {
  try {
    return { ghosts: true, live: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return { ghosts: true, live: true };
  }
}

const startSettings = readSettings();
const startProfile = guestProfile();

interface State {
  phase: Phase;
  mode: ClimbMode;
  /** Null when the API couldn't be reached: the climb still works, it just isn't recorded. */
  run: ClimbRunView | null;
  seed: string;
  /** Bumped on every start, so a retry of the same tower rebuilds it fresh. */
  attempt: number;
  /** Coins, items, loadout and achievements: the server's for accounts, this browser's for guests. */
  profile: ClimbProfileView;
  character: CharacterId;
  trail: string;
  /** Achievements unlocked by the climb that just ended. */
  unlocked: string[];
  lockerOpen: boolean;
  floor: number;
  /** Highest floor reached this run before the first fall. */
  cleanFloor: number;
  coins: number;
  falls: number;
  checkpoint: number;
  zone: number;
  startedAt: number | null;
  endedAt: number | null;
  /** Best floor before this run started, to celebrate beating it. */
  previousBest: number;
  toast: Toast | null;
  /** A wind gust is blowing (snow and storm zones). */
  windy: boolean;
  daily: ClimbDailyView | null;
  /** A challenge link being played ("beat my climb"). */
  challenge: ClimbChallengeView | null;
  /** The challenge link didn't open (deleted, or not a climb). */
  challengeFailed: boolean;
  /** Ghosts raced on this climb: the challenge, my best, the day's leaders. */
  ghosts: Ghost[];
  showGhosts: boolean;
  showLive: boolean;
  /** The finished climb, once its ghost is saved: it can be sent as a challenge. */
  shareRunId: string | null;
  /** Racing friends in a room. Not recorded as a run: the room keeps the score. */
  race: Race | null;

  setMode: (mode: ClimbMode) => void;
  loadProfile: () => Promise<void>;
  /** Wears an owned item. */
  equip: (itemId: string) => Promise<void>;
  /** Buys an item with coins (accounts only). Resolves to an error code, or null on success. */
  buy: (itemId: string) => Promise<string | null>;
  setLockerOpen: (open: boolean) => void;
  start: () => Promise<void>;
  /** Ends the run (summit, or the player stops) and records it. */
  finish: () => Promise<void>;
  backToMenu: () => void;
  reachFloor: (floor: number) => void;
  reachCheckpoint: (floor: number) => void;
  addCoin: () => void;
  addFall: () => void;
  summit: () => void;
  showToast: (toast: Omit<Toast, "id">) => void;
  loadDaily: () => Promise<void>;
  /** Saves progress so far; `keepalive` when the page is closing. */
  report: (keepalive?: boolean) => void;
  loadChallenge: (runId: string) => Promise<void>;
  clearChallenge: () => void;
  loadGhosts: (seed: string) => Promise<void>;
  setOthers: (others: { ghosts?: boolean; live?: boolean }) => void;
  /** The room's countdown began: build its tower and wait at the bottom. */
  startRace: (race: Race) => void;
  /** The countdown is over. */
  go: () => void;
  /** Back to the room's lobby (or out of the room). */
  leaveRace: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** The tower's twist, shown big as the climb starts. */
function announceTwist(seed: string) {
  const twist = towerTwist(seed);
  if (!twist) return;
  const t = TWISTS[twist];
  setTimeout(() => useClimb.getState().showToast({ title: `${t.emoji} ${t.name}`, subtitle: t.blurb, tone: "twist" }), 400);
}
let lastReport = 0;

export const useClimb = create<State>((set, get) => ({
  phase: "menu",
  mode: "daily",
  run: null,
  seed: dailySeed(),
  attempt: 0,
  profile: startProfile,
  character: characterOf(startProfile),
  trail: startProfile.loadout.trail,
  unlocked: [],
  lockerOpen: false,
  floor: 0,
  cleanFloor: 0,
  coins: 0,
  falls: 0,
  checkpoint: 0,
  zone: 0,
  startedAt: null,
  endedAt: null,
  previousBest: 0,
  toast: null,
  windy: false,
  daily: null,
  challenge: null,
  challengeFailed: false,
  ghosts: [],
  showGhosts: startSettings.ghosts,
  showLive: startSettings.live,
  shareRunId: null,
  race: null,

  setMode: (mode) => set({ mode, seed: mode === "daily" ? dailySeed() : get().seed, challenge: null }),

  loadProfile: async () => {
    let profile = guestProfile();
    if (signedIn()) {
      try {
        profile = await api<ClimbProfileView>(`${BASE}/profile`);
      } catch {
        // Offline: show what this browser knows.
      }
    }
    set({ profile, character: characterOf(profile), trail: profile.loadout.trail });
  },

  equip: async (itemId) => {
    const item = climbItem(itemId);
    const { profile } = get();
    if (!item || !profile.owned.includes(itemId)) return;
    const loadout = { ...profile.loadout, [item.kind]: itemId };
    // Wear it at once; the server confirms (or corrects) a moment later.
    set({ profile: { ...profile, loadout }, character: characterOf({ ...profile, loadout }), trail: loadout.trail });
    if (signedIn()) {
      try {
        const saved = await api<ClimbProfileView>(`${BASE}/loadout`, { body: { [item.kind]: itemId } });
        set({ profile: saved, character: characterOf(saved), trail: saved.loadout.trail });
      } catch {
        // Kept for this visit.
      }
    } else {
      saveGuestLoadout(loadout);
    }
  },

  buy: async (itemId) => {
    if (!signedIn()) return "sign_in_required";
    try {
      const profile = await api<ClimbProfileView>(`${BASE}/buy`, { body: { item: itemId } });
      set({ profile, character: characterOf(profile), trail: profile.loadout.trail });
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.code : "request_failed";
    }
  },

  setLockerOpen: (lockerOpen) => set({ lockerOpen }),

  start: async () => {
    const { challenge } = get();
    set({ phase: "starting" });
    let run: ClimbRunView | null = null;
    try {
      run = await api<ClimbRunView>(`${BASE}/runs`, { body: { mode: get().mode, challenge: challenge?.runId } });
    } catch {
      // Offline or API down: climb anyway.
    }
    // A challenge may climb as the daily or as practice, whichever the server decides.
    const mode = run?.mode ?? challenge?.mode ?? get().mode;
    const seed =
      run?.seed ?? challenge?.seed ?? (mode === "daily" ? dailySeed() : practiceSeed(Math.random().toString(36).slice(2)));
    // Guest runs move into the account on sign-in.
    if (run && !signedIn()) rememberClimbRun(run.runId);
    lastReport = 0;
    resetRecording();
    void get().loadGhosts(seed);
    set((s) => ({
      phase: "playing",
      run,
      mode,
      seed,
      shareRunId: null,
      attempt: s.attempt + 1,
      floor: 0,
      cleanFloor: 0,
      coins: 0,
      falls: 0,
      checkpoint: 0,
      zone: 0,
      unlocked: [],
      startedAt: Date.now(),
      endedAt: null,
      previousBest: localBest(mode),
      toast: null,
    }));
    announceTwist(seed);
  },

  finish: async () => {
    const { run, floor, coins, falls, phase, mode, cleanFloor, startedAt, race } = get();
    if (phase !== "playing" && phase !== "summit") return;
    const endedAt = get().endedAt ?? Date.now();
    set({ phase: "over", endedAt });
    if (race) return sendRoomFinish();
    const before = new Set(get().profile.achievements.filter((a) => a.unlocked).map((a) => a.id));
    const ghost = floor > 0 ? encodeGhost(recordedFrames()) : undefined;
    const seconds = (endedAt - (startedAt ?? endedAt)) / 1000;
    if (ghost) keepLocalGhost({ seed: get().seed, floor, seconds, ghost });
    if (run) {
      try {
        await api(`${BASE}/runs/${run.runId}/finish`, { body: { floor, coins, falls, ghost } });
        if (ghost) set({ shareRunId: run.runId });
      } catch {
        // Not recorded; the result screen still shows the climb.
      }
    }
    if (!signedIn()) {
      recordGuestClimb({
        daily: mode === "daily",
        date: today(),
        floor,
        cleanFloor,
        coins,
        falls,
        summit: floor >= FLOORS,
        timeMs: endedAt - (startedAt ?? endedAt),
        twist: towerTwist(get().seed),
      });
    }
    await get().loadProfile();
    set({ unlocked: get().profile.achievements.filter((a) => a.unlocked && !before.has(a.id)).map((a) => a.id) });
    if (mode === "daily") void get().loadDaily();
  },

  // A fresh tower at the bottom for the menu's preview.
  backToMenu: () =>
    set((s) => ({ phase: "menu", toast: null, attempt: s.attempt + 1, seed: s.mode === "daily" ? dailySeed() : s.seed })),

  reachFloor: (floor) => {
    const { mode, previousBest, falls, race, floor: before } = get();
    set(falls === 0 ? { floor, cleanFloor: floor } : { floor });
    const zone = zoneIndexOf(floor);
    if (zone !== get().zone) set({ zone });
    if (race) return sendRoomProgress(floor);
    if (floor > localBest(mode)) writeNumber(bestKey(mode), floor);
    // Passing the old best (a cannon can fly straight past it).
    if (previousBest > 0 && before <= previousBest && floor > previousBest) {
      get().showToast({ title: "New best!", subtitle: `Higher than ever: floor ${floor}`, tone: "best" });
    }
    // Floors between checkpoints are saved every few seconds, so leaving early still counts.
    if (Date.now() - lastReport > 4000) get().report();
  },

  reachCheckpoint: (floor) => {
    set({ checkpoint: floor });
    get().report();
  },

  addCoin: () => set((s) => ({ coins: s.coins + 1 })),
  addFall: () => set((s) => ({ falls: s.falls + 1 })),

  summit: () => {
    set({ phase: "summit", floor: FLOORS, endedAt: Date.now() });
    if (get().race) sendRoomProgress(FLOORS);
    // Let the celebration play before the results.
    setTimeout(() => void get().finish(), 3200);
  },

  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast: { ...toast, id: Date.now() } });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },

  loadDaily: async () => {
    try {
      set({ daily: await api<ClimbDailyView>(`${BASE}/daily`) });
    } catch {
      // The menu just doesn't show the leaderboard.
    }
  },

  report: (keepalive = false) => {
    const { run, floor, coins, falls, phase } = get();
    if (!run || (phase !== "playing" && phase !== "summit")) return;
    lastReport = Date.now();
    api(`${BASE}/runs/${run.runId}/progress`, { body: { floor, coins, falls }, keepalive }).catch(() => {
      // Rejected (too fast) or offline: the next report tries again.
    });
  },

  loadChallenge: async (runId) => {
    if (get().challenge?.runId === runId) return;
    try {
      const challenge = await api<ClimbChallengeView>(`${BASE}/challenge/${runId}`);
      set((s) => ({ challenge, challengeFailed: false, mode: challenge.mode, seed: challenge.seed, attempt: s.attempt + 1 }));
    } catch {
      set({ challenge: null, challengeFailed: true });
    }
  },

  clearChallenge: () => {
    const { mode, challenge } = get();
    if (!challenge) return set({ challengeFailed: false });
    set((s) => ({ challenge: null, challengeFailed: false, seed: mode === "daily" ? dailySeed() : s.seed, attempt: s.attempt + 1 }));
  },

  loadGhosts: async (seed) => {
    const { challenge, showGhosts } = get();
    const ghosts: Ghost[] = [];
    const add = (g: Ghost | null) => g && !ghosts.some((x) => x.id === g.id) && ghosts.push(g);
    if (challenge?.seed === seed) add(toGhost(challenge, true));
    if (showGhosts) {
      let views: ClimbGhostView[] = [];
      try {
        views = await api<ClimbGhostView[]>(`${BASE}/ghosts?seed=${encodeURIComponent(seed)}`);
      } catch {
        // Offline: only this browser's own ghost.
      }
      // Guests (or offline) race the best climb this browser kept.
      const local = localGhost(seed);
      if (local && !views.some((v) => v.isMe)) {
        add(toGhost({ runId: "local", name: "", avatar: useAvatar.getState().config, floor: local.floor, seconds: local.seconds, isMe: true, ghost: local.ghost }));
      }
      for (const v of views) add(toGhost(v));
    }
    for (const g of ghosts) if (g.isMe) g.name = "Your best";
    if (get().seed === seed) set({ ghosts });
  },

  setOthers: (others) => {
    const { showGhosts, showLive } = get();
    const next = { ghosts: others.ghosts ?? showGhosts, live: others.live ?? showLive };
    set({ showGhosts: next.ghosts, showLive: next.live });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Remembered for this page view.
    }
  },

  startRace: (race) => {
    resetRecording();
    set((s) => ({
      race,
      phase: "countdown",
      seed: race.seed,
      run: null,
      shareRunId: null,
      ghosts: [],
      attempt: s.attempt + 1,
      floor: 0,
      cleanFloor: 0,
      coins: 0,
      falls: 0,
      checkpoint: 0,
      zone: 0,
      unlocked: [],
      startedAt: race.startAt,
      endedAt: null,
      previousBest: 0,
      toast: null,
    }));
  },

  go: () => {
    if (get().phase !== "countdown") return;
    set({ phase: "playing" });
    announceTwist(get().seed);
  },

  leaveRace: () => {
    if (!get().race) return;
    set({ race: null });
    get().backToMenu();
  },
}));
