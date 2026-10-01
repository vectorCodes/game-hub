// Guess matching lives in the shared package so the API can reuse it verbatim
// once guesses are validated server-side.

export function normalizeGuess(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(a|an|the) /, "");
}

function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Typo tolerance grows with answer length: none for short words, 1 for 5+, 2 for 9+. */
function allowedTypos(length: number): number {
  if (length >= 9) return 2;
  if (length >= 5) return 1;
  return 0;
}

export function isCorrectGuess(guess: string, answers: string[]): boolean {
  const g = singular(normalizeGuess(guess));
  if (!g) return false;
  return answers.some((answer) => {
    const a = singular(normalizeGuess(answer));
    return g === a || levenshtein(g, a) <= allowedTypos(a.length);
  });
}

const FILLER_WORDS = new Set(["and", "with", "for", "of"]);

/**
 * A wrong guess that's warm: it shares a word with an answer ("office chair" for
 * "Armchair"'s alias "chair") or is one typo past the tolerance. Gives nothing else away.
 */
export function isCloseGuess(guess: string, answers: string[]): boolean {
  const g = singular(normalizeGuess(guess));
  if (!g) return false;
  const words = (s: string) => s.split(" ").map(singular).filter((w) => w.length >= 3 && !FILLER_WORDS.has(w));
  const guessWords = new Set(words(g));
  return answers.some((answer) => {
    const a = singular(normalizeGuess(answer));
    if (words(a).some((w) => guessWords.has(w))) return true;
    return a.length >= 4 && levenshtein(g, a) <= allowedTypos(a.length) + 1;
  });
}
