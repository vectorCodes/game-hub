import { z } from "zod";

// GameHub avatars: one character per player, worn in every game. Built from Kenney's Mini
// Characters: any character's head (hair & face) on any character's body (outfit), with
// recoloured skin, hair and clothes, plus a hat and eyewear.

/** The 12 Mini Characters: each is both a hair style (its head) and an outfit (its body). */
export const AVATAR_STYLES = [
  "male-a",
  "female-a",
  "male-b",
  "female-b",
  "male-c",
  "female-c",
  "male-d",
  "female-d",
  "male-e",
  "female-e",
  "male-f",
  "female-f",
] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

/** A colour from the characters' palette texture: column and row of a 32×128 px swatch. */
export interface Swatch {
  id: string;
  name: string;
  cell: [number, number];
  hex: string;
}

const swatch = (id: string, name: string, col: number, row: number, hex: string): Swatch => ({ id, name, cell: [col, row], hex });

export const SKIN_TONES: Swatch[] = [
  swatch("porcelain", "Porcelain", 0, 2, "#fde4c7"),
  swatch("light", "Light", 14, 3, "#f2bf99"),
  swatch("peach", "Peach", 15, 3, "#e3a983"),
  swatch("tan", "Tan", 11, 3, "#df8760"),
  swatch("bronze", "Bronze", 12, 3, "#b06041"),
  swatch("brown", "Brown", 13, 3, "#a25c41"),
];

export const HAIR_COLORS: Swatch[] = [
  swatch("black", "Black", 0, 3, "#38383d"),
  swatch("charcoal", "Charcoal", 1, 3, "#41414a"),
  swatch("brown", "Brown", 13, 3, "#a25c41"),
  swatch("auburn", "Auburn", 12, 3, "#b06041"),
  swatch("ginger", "Ginger", 11, 3, "#df8760"),
  swatch("blonde", "Blonde", 5, 2, "#ffc053"),
  swatch("silver", "Silver", 2, 3, "#868ba1"),
  swatch("white", "White", 9, 3, "#eaeaf2"),
  swatch("pink", "Pink", 0, 1, "#f378f0"),
  swatch("red", "Red", 8, 2, "#cf534f"),
  swatch("blue", "Blue", 10, 2, "#6794d9"),
  swatch("purple", "Purple", 14, 2, "#a878e8"),
  swatch("green", "Green", 2, 2, "#61cb8b"),
];

export const OUTFIT_COLORS: Swatch[] = [
  swatch("red", "Red", 8, 2, "#cf534f"),
  swatch("coral", "Coral", 9, 2, "#f16544"),
  swatch("orange", "Orange", 6, 2, "#ff7e44"),
  swatch("yellow", "Yellow", 4, 2, "#ffc044"),
  swatch("mint", "Mint", 2, 2, "#61cb8b"),
  swatch("green", "Green", 3, 2, "#4cb681"),
  swatch("sky", "Sky", 12, 2, "#d0e8ff"),
  swatch("blue", "Blue", 10, 2, "#6794d9"),
  swatch("navy", "Navy", 11, 2, "#6282d1"),
  swatch("lilac", "Lilac", 14, 2, "#a878e8"),
  swatch("purple", "Purple", 15, 2, "#8f63d8"),
  swatch("pink", "Pink", 0, 1, "#f378f0"),
  swatch("cream", "Cream", 0, 2, "#fde4c7"),
  swatch("white", "White", 8, 3, "#ffffff"),
  swatch("grey", "Grey", 2, 3, "#868ba1"),
  swatch("slate", "Slate", 4, 3, "#4f5260"),
  swatch("black", "Black", 0, 3, "#38383d"),
];

export const AvatarConfig = z.object({
  /** Hair style and face: a character's head. */
  head: z.enum(AVATAR_STYLES),
  /** Outfit: a character's body. */
  body: z.enum(AVATAR_STYLES),
  skin: z.string(),
  hair: z.string(),
  top: z.string(),
  bottom: z.string(),
  shoes: z.string(),
  /** Item ids: "hat:none", "eyewear:none"… */
  hat: z.string(),
  eyewear: z.string(),
});
export type AvatarConfig = z.infer<typeof AvatarConfig>;

export const DEFAULT_AVATAR: AvatarConfig = {
  head: "male-a",
  body: "male-a",
  skin: "peach",
  hair: "brown",
  top: "green",
  bottom: "navy",
  shoes: "yellow",
  hat: "hat:none",
  eyewear: "eyewear:none",
};

/** Problems with a config for a player who owns `owned` (item ids); empty when it's fine. */
export function avatarProblems(config: AvatarConfig, owned: string[]): string[] {
  const problems: string[] = [];
  const has = (id: string) => owned.includes(id);
  if (!has(`character:${config.head}`)) problems.push("head_locked");
  if (!has(`character:${config.body}`)) problems.push("body_locked");
  if (!SKIN_TONES.some((s) => s.id === config.skin)) problems.push("skin_unknown");
  if (!HAIR_COLORS.some((s) => s.id === config.hair)) problems.push("hair_unknown");
  for (const part of ["top", "bottom", "shoes"] as const) {
    if (!OUTFIT_COLORS.some((s) => s.id === config[part])) problems.push(`${part}_unknown`);
  }
  if (!config.hat.startsWith("hat:") || !has(config.hat)) problems.push("hat_locked");
  if (!config.eyewear.startsWith("eyewear:") || !has(config.eyewear)) problems.push("eyewear_locked");
  return problems;
}

/** The parts of `config` the player doesn't own, swapped for defaults. */
export function fixAvatar(config: AvatarConfig, owned: string[]): AvatarConfig {
  const problems = avatarProblems(config, owned);
  if (!problems.length) return config;
  const fixed = { ...config };
  for (const p of problems) {
    const key = p.split("_")[0] as keyof AvatarConfig;
    (fixed as Record<string, string>)[key] = DEFAULT_AVATAR[key];
  }
  return fixed;
}

/** Stable key for caching rendered portraits. */
export const avatarKey = (c: AvatarConfig) =>
  [c.head, c.body, c.skin, c.hair, c.top, c.bottom, c.shoes, c.hat, c.eyewear].join("|");

export const AvatarBody = z.object({ config: AvatarConfig });

export interface AvatarView {
  /** Null until the player saves one. */
  config: AvatarConfig | null;
  owned: string[];
  coins: number;
}
