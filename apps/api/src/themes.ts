import { readFileSync } from "node:fs";
import { z } from "zod";
import type { ThemeView } from "@shadow/shared";
import { THEMES_PATH } from "./paths";

const Theme = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    emoji: z.string().min(1),
    /** Inclusive UTC dates. */
    start: z.iso.date(),
    end: z.iso.date(),
    /** The daily puzzle is drawn from these categories plus these object ids. */
    categories: z.array(z.string()).default([]),
    objects: z.array(z.string()).default([]),
  })
  .refine((t) => t.start <= t.end, { message: "start is after end" })
  .refine((t) => t.categories.length + t.objects.length > 0, { message: "theme has no objects" });
export type Theme = z.infer<typeof Theme>;

/** Reads and checks assets/themes.json. Themes may not overlap: a day has one theme at most. */
export function readThemes(path = THEMES_PATH): Theme[] {
  const themes = z.object({ themes: z.array(Theme) }).parse(JSON.parse(readFileSync(path, "utf8"))).themes;
  const sorted = [...themes].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start <= sorted[i - 1].end) {
      throw new Error(`Themes ${sorted[i - 1].id} and ${sorted[i].id} overlap`);
    }
  }
  return sorted;
}

/** Throws if a theme names an object or category the catalog doesn't have. */
export function checkThemes(themes: Theme[], catalog: { id: string; category: string }[]) {
  const ids = new Set(catalog.map((o) => o.id));
  const categories = new Set(catalog.map((o) => o.category));
  for (const t of themes) {
    const missing = [
      ...t.objects.filter((id) => !ids.has(id)),
      ...t.categories.filter((c) => !categories.has(c)),
    ];
    if (missing.length) throw new Error(`Theme ${t.id} names unknown objects or categories: ${missing.join(", ")}`);
  }
}

export function themeOn(themes: Theme[], date: string): Theme | undefined {
  return themes.find((t) => t.start <= date && date <= t.end);
}

/** Whether an object belongs to a theme. */
export function fitsTheme(theme: Theme, object: { id: string; category: string }): boolean {
  return theme.categories.includes(object.category) || theme.objects.includes(object.id);
}

export function themeView(theme: Theme | undefined): ThemeView | null {
  return theme ? { id: theme.id, name: theme.name, emoji: theme.emoji, start: theme.start, end: theme.end } : null;
}
