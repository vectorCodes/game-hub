// Pair Pop's progress, kept in this browser: stars on each level (which also unlocks the
// next one), today's daily result, and a guest's game ids (moved into the account on
// sign-in). Light, so the hub tile and the auth store can import it.
import { today } from "./deck";

const STARS_KEY = "pair-pop:stars";
const GAMES_KEY = "pair-pop:guest-games";
const dailyKey = (date: string) => `pair-pop:daily:${date}`;

export interface DailyResult {
  moves: number;
  seconds: number;
  score: number;
  stars: number;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): it lasts for this page view.
  }
}

/** Best stars on each level, by index; 0 or missing means not cleared. */
export function savedStars(): number[] {
  const stars = readJson<unknown>(STARS_KEY, []);
  return Array.isArray(stars) ? stars : [];
}

export function rememberStars(level: number, stars: number) {
  const all = savedStars();
  if ((all[level] ?? 0) >= stars) return;
  all[level] = stars;
  write(STARS_KEY, Array.from(all, (s) => s ?? 0));
}

/** A level is open once the one before it is cleared. */
export const levelUnlocked = (level: number, stars = savedStars()) => level === 0 || (stars[level - 1] ?? 0) > 0;

export const savedDaily = (date = today()): DailyResult | null => readJson<DailyResult | null>(dailyKey(date), null);

/** Only the first finish counts: one shot at the daily, like the other games. */
export function rememberDaily(result: DailyResult, date = today()) {
  if (!savedDaily(date)) write(dailyKey(date), result);
}

/** Guest games from this browser, newest last. */
export function savedGameIds(): string[] {
  const ids = readJson<unknown>(GAMES_KEY, []);
  return Array.isArray(ids) ? ids : [];
}

export function rememberGame(id: string) {
  const ids = savedGameIds();
  if (!ids.includes(id)) write(GAMES_KEY, [...ids, id].slice(-200));
}

export function forgetGames() {
  try {
    localStorage.removeItem(GAMES_KEY);
  } catch {
    // Nothing to forget.
  }
}
