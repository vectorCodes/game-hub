// What a guest's Sky Climb progress looks like without an account, kept in this browser:
// their run ids (claimed into the account on sign-in), their stats for achievements, and
// what they wear. Kept free of the game's heavier modules so the auth store can import it.
import {
  DEFAULT_LOADOUT,
  EMPTY_METRICS,
  FAST_SUMMIT_MS,
  TWISTED_FLOOR,
  climbItem,
  evaluateAchievements,
  isFreeItem,
  ownedItems,
  type ClimbMetrics,
  type ClimbProfileView,
  type TwistId,
} from "@shadow/shared";

const RUNS_KEY = "sky-climb:guest-runs";
const STATS_KEY = "sky-climb:guest-stats";
const LOADOUT_KEY = "sky-climb:loadout";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): progress lasts for this page view.
  }
}

/** Guest runs from this browser, newest last. */
export function savedClimbRunIds(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(RUNS_KEY) ?? "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function rememberClimbRun(id: string) {
  write(RUNS_KEY, [...savedClimbRunIds(), id].slice(-200));
}

export function forgetClimbRuns() {
  try {
    localStorage.removeItem(RUNS_KEY);
  } catch {
    // Nothing to forget.
  }
}

interface GuestStats {
  metrics: ClimbMetrics;
  lastDailyDate: string | null;
  currentStreak: number;
  /** Daily twists climbed to TWISTED_FLOOR (the metric counts them). */
  twisted: TwistId[];
}

const EMPTY_STATS: GuestStats = { metrics: EMPTY_METRICS, lastDailyDate: null, currentStreak: 0, twisted: [] };

export interface FinishedClimb {
  daily: boolean;
  date: string;
  floor: number;
  cleanFloor: number;
  coins: number;
  falls: number;
  summit: boolean;
  timeMs: number;
  twist: TwistId | null;
}

/** Folds a finished climb into the guest's stats (the server does the same for accounts). */
export function recordGuestClimb(c: FinishedClimb) {
  const s = read(STATS_KEY, EMPTY_STATS);
  const m = { ...EMPTY_METRICS, ...s.metrics };
  m.bestFloor = Math.max(m.bestFloor, c.floor);
  m.summits += c.summit ? 1 : 0;
  m.cleanFloor = Math.max(m.cleanFloor, c.cleanFloor);
  if (c.summit && c.timeMs < FAST_SUMMIT_MS) m.fastSummit = 1;
  m.maxRunCoins = Math.max(m.maxRunCoins, c.coins);
  m.coinsTotal += c.coins;
  m.maxFalls = Math.max(m.maxFalls, c.falls);
  const twisted = new Set(s.twisted);
  if (c.daily && c.twist && c.floor >= TWISTED_FLOOR) twisted.add(c.twist);
  m.twists = twisted.size;
  let { lastDailyDate, currentStreak } = s;
  if (c.daily && c.floor > 0 && c.date !== lastDailyDate) {
    const yesterday = new Date(Date.parse(c.date) - 86_400_000).toISOString().slice(0, 10);
    currentStreak = lastDailyDate === yesterday ? currentStreak + 1 : 1;
    lastDailyDate = c.date;
    m.maxStreak = Math.max(m.maxStreak, currentStreak);
  }
  write(STATS_KEY, { metrics: m, lastDailyDate, currentStreak, twisted: [...twisted] });
}

/** A guest's locker: coins to see (spending needs an account), free items, achievements. */
export function guestProfile(): ClimbProfileView {
  const s = read(STATS_KEY, EMPTY_STATS);
  const metrics = { ...EMPTY_METRICS, ...s.metrics };
  const achievements = evaluateAchievements(metrics);
  const owned = ownedItems([], achievements);
  const saved = read(LOADOUT_KEY, DEFAULT_LOADOUT);
  const usable = (id: string, kind: "character" | "trail") => {
    const item = climbItem(id);
    return item?.kind === kind && owned.includes(id) && (isFreeItem(item) || item.achievement) ? id : DEFAULT_LOADOUT[kind];
  };
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  return {
    coins: { earned: metrics.coinsTotal, spent: 0, balance: metrics.coinsTotal },
    owned,
    loadout: { character: usable(saved.character, "character"), trail: usable(saved.trail, "trail") },
    achievements,
    metrics,
    currentStreak: s.lastDailyDate === today || s.lastDailyDate === yesterday ? s.currentStreak : 0,
    shadowGuess: { maxStreak: 0, won: 0 },
  };
}

export function saveGuestLoadout(loadout: { character: string; trail: string }) {
  write(LOADOUT_KEY, loadout);
}
