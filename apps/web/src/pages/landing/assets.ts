// Asset list for the landing world. Kept free of three.js imports so the page can start
// preloading these alongside the 3D bundle instead of after it.

export const landingModel = (name: string) => `/landing/models/${name}.glb`;

/** The hidden object behind the shadow wall. */
export const WALL_MODEL = "reindeer";

/** The exhibits in the glade, left to right. */
export const GLADE_MODELS = ["chair", "astronaut", "snowman", "palm-tree", "ice-cream", "locomotive", "potted-plant"];

/**
 * Fetch every model in parallel with the 3D bundle, rather than in a waterfall after it.
 * `as="fetch"` + `crossOrigin="anonymous"` matches how three's loader requests them, so the
 * browser reuses these responses.
 */
export function preloadLandingModels() {
  for (const name of [WALL_MODEL, ...GLADE_MODELS]) {
    const href = landingModel(name);
    if (document.head.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    link.crossOrigin = "anonymous";
    link.href = href;
    document.head.appendChild(link);
  }
}
