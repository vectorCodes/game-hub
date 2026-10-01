import { useMemo } from "react";
import type { RunView } from "@shadow/shared";

const STORAGE_KEY = "shadow-guess:best-run";

interface SavedRuns {
  /** Best of the runs before `runId`. */
  prior: number;
  runId: string;
  solved: number;
}

function read(): SavedRuns | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

/**
 * The best earlier run to beat. Signed-in players get it from the server; guests keep it in
 * this browser, updated as their current run grows.
 */
export function useRunBest(run: RunView | null): number {
  return useMemo(() => {
    if (!run) return 0;
    if (run.best !== null) return run.best;
    const saved = read();
    const prior = !saved ? 0 : saved.runId === run.id ? saved.prior : Math.max(saved.prior, saved.solved);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ prior, runId: run.id, solved: run.solved } satisfies SavedRuns));
    } catch {
      // Storage unavailable: the best only lasts for this run.
    }
    return prior;
  }, [run]);
}
