import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ASSETS_DIR = resolve(import.meta.dirname, "../../../assets");
export const RAW_DIR = resolve(ASSETS_DIR, "raw");
export const MODELS_DIR = resolve(ASSETS_DIR, "models");
export const CATALOG_PATH = resolve(ASSETS_DIR, "catalog.json");
export const MANIFEST_PATH = resolve(MODELS_DIR, "manifest.json");

export interface CatalogSource {
  id: string;
  /** "<kenney-kit>/<file name without .glb>" */
  source: string;
  category?: string;
  /** Subdivision passes: 0 keeps the low-poly facets, 1 softens, 2 rounds. */
  smooth?: number;
}

/** Organic shapes read better rounded; man-made, boxy ones keep their crisp edges. */
const ROUNDED_CATEGORIES = new Set(["Food", "Nature", "Animals"]);

export function smoothLevel({ smooth, category }: CatalogSource): number {
  if (smooth !== undefined) return smooth;
  return category && ROUNDED_CATEGORIES.has(category) ? 2 : 0;
}

export function readCatalog(): CatalogSource[] {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8")).objects;
}
