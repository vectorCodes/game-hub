import { resolve } from "node:path";

export const ASSETS_DIR = resolve(import.meta.dirname, "../../../assets");
export const CATALOG_PATH = resolve(ASSETS_DIR, "catalog.json");
export const MODELS_DIR = resolve(ASSETS_DIR, "models");
export const MANIFEST_PATH = resolve(MODELS_DIR, "manifest.json");
export const MIGRATIONS_DIR = resolve(import.meta.dirname, "../drizzle");
