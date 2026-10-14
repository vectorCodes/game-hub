// Dates for the daily. Dealing and scoring live in @shadow/shared, where the server uses them too.
import { pairPopDailyNumber } from "@shadow/shared";

export { pairsOf } from "@shadow/shared";

/** Today's UTC date, which is what the daily runs on. */
export const today = () => new Date().toISOString().slice(0, 10);

/** Daily #1 is launch day. */
export const dailyNumber = (date = today()) => pairPopDailyNumber(date);
