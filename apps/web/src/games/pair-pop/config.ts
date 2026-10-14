// Pair Pop tuning: the look and feel of the board. The levels, pals and scoring are shared
// with the server (@shadow/shared), which scores the games.
import { PAIR_POP_LEVELS, PAIR_POP_PALS, type PairPopLevel } from "@shadow/shared";

export const PAIR_POP_HOME = "/games/pair-pop";
export const PAIR_POP_PATH = "/games/pair-pop/play";

/** The pals are Kenney models from Shadow Guess's catalog, copied into `public/pair-pop`. */
export const palUrl = (id: string) => `/pair-pop/models/${id}.glb`;

export const LEVELS = PAIR_POP_LEVELS;
export type Level = PairPopLevel;
export const ALL_PALS = PAIR_POP_PALS;

export const TILE = {
  size: 1,
  gap: 0.16,
  thickness: 0.16,
  radius: 0.1,
  /** A pal's largest dimension, standing on its tile. */
  palSize: 0.62,
};

export const TIMING = {
  /** Between two matching tiles turning over and them counting as matched (ms). */
  matchDelay: 260,
  /** How long a wrong pair stays up before turning back, unless the next tile is picked (ms). */
  missHold: 900,
  /** Between deal-in finishing and the peek. */
  dealStagger: 0.035,
  /** After the last match, before the results. */
  winDelay: 1400,
};

/** Spring for flips: a touch of overshoot so a tile lands with a little bounce. */
export const SPRING = { stiffness: 210, damping: 19 };
