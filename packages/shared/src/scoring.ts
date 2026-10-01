export const MAX_STEPS = 6;
/** A skipped angle is stored as an empty wrong guess. */
export const SKIPPED = "";
export const WRONG_PENALTY = 15;
export const HINT_PENALTY = 10;

export function computeScore(wrongGuesses: number, hintUsed: boolean): number {
  return Math.max(0, 100 - WRONG_PENALTY * wrongGuesses - (hintUsed ? HINT_PENALTY : 0));
}
