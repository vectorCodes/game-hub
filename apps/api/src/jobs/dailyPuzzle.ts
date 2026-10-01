import type { ShadowGuessService } from "../modules/shadow-guess/service";

const HOUR = 3_600_000;

/**
 * Makes sure today's and tomorrow's daily puzzles exist, at startup and hourly, so the
 * first player after midnight UTC never races to create one.
 */
export function startDailyPuzzleJob(service: ShadowGuessService, log: (msg: string) => void) {
  const run = async () => {
    const now = Date.now();
    for (const t of [now, now + 24 * HOUR]) {
      await service.ensureDailyPuzzle(new Date(t).toISOString().slice(0, 10));
    }
  };
  const tick = () => run().catch((e) => log(`daily puzzle job failed: ${e}`));
  void tick();
  const timer = setInterval(tick, HOUR);
  timer.unref();
  return () => clearInterval(timer);
}
