// Bumper Arena's progress kept in this browser: today's Gauntlet result, the best one ever,
// and a guest's run ids (moved into the account on sign-in). Light, so the hub tile and the
// auth store can import it.

const RUNS_KEY = "bumper:guest-runs";
const BEST_KEY = "bumper:best";
const dailyKey = (date: string) => `bumper:daily:${date}`;

/** Today's UTC date, which is what the Gauntlet runs on. */
export const today = () => new Date().toISOString().slice(0, 10);

export interface GauntletResult {
  waves: number;
  kos: number;
  score: number;
  peakWobble: number;
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

export const savedDaily = (date = today()): GauntletResult | null => readJson<GauntletResult | null>(dailyKey(date), null);

/** Only the first finish counts: one shot at the Gauntlet a day, like the other games. */
export function rememberDaily(result: GauntletResult, date = today()) {
  if (!savedDaily(date)) write(dailyKey(date), result);
  if (result.waves > savedBest()) write(BEST_KEY, result.waves);
}

/** Most waves this browser has ever cleared in a Gauntlet. */
export const savedBest = (): number => {
  const best = readJson<unknown>(BEST_KEY, 0);
  return typeof best === "number" ? best : 0;
};

/** Guest runs from this browser, newest last. */
export function savedRunIds(): string[] {
  const ids = readJson<unknown>(RUNS_KEY, []);
  return Array.isArray(ids) ? ids : [];
}

export function rememberRun(id: string) {
  const ids = savedRunIds();
  if (!ids.includes(id)) write(RUNS_KEY, [...ids, id].slice(-200));
}

export function forgetRuns() {
  try {
    localStorage.removeItem(RUNS_KEY);
  } catch {
    // Nothing to forget.
  }
}
