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
}

export function readCatalog(): CatalogSource[] {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8")).objects;
}
