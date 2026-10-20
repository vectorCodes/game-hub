import { z } from "zod";

// Prop Hunt levels: signed-in players earn XP from every match (the room reports the results
// to the API, so nobody can award themselves any), levels follow from XP, and levels unlock
// taunt sounds. See Prop-hunt-roadmap.md.

/** Every taunt sound, in the order they unlock. The ids are the web app's sound names. */
export const HUNT_TAUNTS = [
  { id: "squeak", name: "Squeak", level: 1 },
  { id: "honk", name: "Honk", level: 1 },
  { id: "boing", name: "Boing", level: 1 },
  { id: "whistle", name: "Whistle", level: 1 },
  { id: "quack", name: "Duck quack", level: 2 },
  { id: "fart", name: "Fart", level: 3 },
  { id: "slideWhistle", name: "Slide whistle", level: 4 },
  { id: "bikeHorn", name: "Bike horn", level: 4 },
  { id: "trombone", name: "Sad trombone", level: 5 },
  { id: "sproing", name: "Cartoon spring", level: 6 },
  { id: "kazoo", name: "Kazoo", level: 7 },
  { id: "cuckoo", name: "Cuckoo clock", level: 8 },
  { id: "rubberChicken", name: "Rubber chicken", level: 9 },
  { id: "raspberry", name: "Raspberry", level: 10 },
  { id: "airhorn", name: "Air horn", level: 12 },
  { id: "pew", name: "Pew pew", level: 14 },
  { id: "rimshot", name: "Ba-dum-tss", level: 16 },
  { id: "siren", name: "Siren", level: 18 },
] as const;

export type HuntTauntId = (typeof HUNT_TAUNTS)[number]["id"];
const TAUNT_IDS = new Set<string>(HUNT_TAUNTS.map((t) => t.id));
export const isHuntTaunt = (id: string): id is HuntTauntId => TAUNT_IDS.has(id);
/** What everyone starts with (and guests always have): taunts shuffle through these. */
export const HUNT_STARTER_TAUNTS: HuntTauntId[] = HUNT_TAUNTS.filter((t) => t.level === 1).map((t) => t.id);

/** The taunts a level has unlocked. */
export const tauntsAt = (level: number): HuntTauntId[] => HUNT_TAUNTS.filter((t) => t.level <= level).map((t) => t.id);

/** Total XP that reaches `level`: 100 for level 2, 300 for 3, 1,000 for 5, 4,500 for 10… */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

/** XP for finishing a match, and for the podium. */
export const HUNT_XP = { finish: 50, places: [100, 50, 25] } as const;

/** A match's XP: its points, plus finishing, plus a podium place. Leaving early earns nothing. */
export function matchXp(score: number, place: number, dnf: boolean): number {
  if (dnf) return 0;
  return Math.max(0, Math.round(score)) + HUNT_XP.finish + (HUNT_XP.places[place - 1] ?? 0);
}

/** A signed-in player's Prop Hunt progress, as the API returns it. */
export interface HuntProgress {
  xp: number;
  level: number;
  /** XP where this level started, and where the next one starts. */
  levelXp: number;
  nextLevelXp: number;
  matches: number;
  wins: number;
  /** Unlocked taunts, in unlock order. */
  unlocked: HuntTauntId[];
  /** The taunts they've picked: one plays every time, several shuffle. */
  taunts: HuntTauntId[];
}

export function huntProgress(row: { xp: number; matches: number; wins: number; taunts: string[] | null }): HuntProgress {
  const level = levelForXp(row.xp);
  const unlocked = tauntsAt(level);
  const picked = (row.taunts ?? []).filter((t): t is HuntTauntId => unlocked.includes(t as HuntTauntId));
  return {
    xp: row.xp,
    level,
    levelXp: xpForLevel(level),
    nextLevelXp: xpForLevel(level + 1),
    matches: row.matches,
    wins: row.wins,
    unlocked,
    taunts: picked.length ? picked : HUNT_STARTER_TAUNTS,
  };
}

/** Changing your taunts. */
export const HuntLoadoutBody = z.object({ taunts: z.array(z.string().max(32)).min(1).max(HUNT_TAUNTS.length) });

/** The room reporting a finished match (server to server, with the shared secret). */
export const HuntResultsBody = z.object({
  /** Unique per match, so a retried report doesn't count twice. */
  matchId: z.string().min(8).max(80),
  players: z
    .array(z.object({ userId: z.uuid(), score: z.int().min(-100_000).max(100_000), place: z.int().min(1).max(8), dnf: z.boolean() }))
    .max(8),
});
export type HuntResultsBody = z.infer<typeof HuntResultsBody>;

/** What a match did for one player: shown on the podium. */
export interface HuntXpGain {
  userId: string;
  gained: number;
  xp: number;
  levelBefore: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  /** Taunts this match unlocked. */
  unlocked: HuntTauntId[];
}

export const HUNT_RESULTS_SECRET_HEADER = "x-hunt-secret";
