// What a guest's Putt Isles rounds look like without an account, kept in this browser:
// their round ids (claimed into the account on sign-in), today's daily round to pick back
// up, and today's result for the landing page. Light, so the auth store can import it.

const ROUNDS_KEY = "putt-isles:guest-rounds";
const dailyKey = (date: string) => `putt-isles:daily:${date}`;
const resultKey = (date: string) => `putt-isles:result:${date}`;

export const today = () => new Date().toISOString().slice(0, 10);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode): it lasts for this page view.
  }
}

/** Guest rounds from this browser, newest last. */
export function savedPuttRoundIds(): string[] {
  const ids = readJson<unknown>(ROUNDS_KEY, []);
  return Array.isArray(ids) ? ids : [];
}

export function rememberPuttRound(id: string) {
  const ids = savedPuttRoundIds();
  if (!ids.includes(id)) write(ROUNDS_KEY, JSON.stringify([...ids, id].slice(-200)));
}

export function forgetPuttRounds() {
  try {
    localStorage.removeItem(ROUNDS_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** Today's daily round in this browser, to carry on with. */
export const savedDailyRound = (date = today()): string | null => readJson<string | null>(dailyKey(date), null);

export function rememberDailyRound(id: string, date = today()) {
  write(dailyKey(date), JSON.stringify(id));
}

/** Strokes on each hole of today's daily, as far as this browser played it. */
export const savedDailyResult = (date = today()): number[] => readJson<number[]>(resultKey(date), []);

export function rememberDailyResult(strokes: number[], date = today()) {
  write(resultKey(date), JSON.stringify(strokes));
}
