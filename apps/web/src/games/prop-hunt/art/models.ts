// Which furniture and props are drawn with a Poly Haven model (fetched, stood on its base and
// measured by tools/models/src/propHunt.ts; size and solid shape in models.json), and how each
// model is fitted: stretched to the box the kind's parts fill. Its colliders come from its solid
// shape (art/colliders.ts), so what you see is what you bump into.
import { partBox, type Box, type PropKind } from "@shadow/shared";
import sizes from "./models.json";

export type ModelKey = keyof typeof sizes;

export const modelUrl = (key: ModelKey) => `/prop-hunt/models/${key}.glb`;
export const modelSize = (key: ModelKey) => sizes[key].size as [number, number, number];
/** The model's solid shape: boxes [x0, x1, z0, z1, y0, y1] as fractions of its size. */
export const modelSolid = (key: ModelKey) => sizes[key].solid as number[][];

/**
 * By kind: one model for the whole piece, or one per part (`part` is the part's index; the
 * other parts are drawn as usual).
 */
export const KIND_MODELS: Partial<Record<string, { model: ModelKey; part?: number }[]>> = {
  sofa: [{ model: "sofa" }],
  armchair: [{ model: "armchair" }],
  coffeeTable: [{ model: "coffeeTable" }],
  tvUnit: [
    { model: "cabinet", part: 0 },
    { model: "tv", part: 1 },
  ],
  plantBig: [{ model: "plant" }],
  diningTable: [{ model: "diningTable" }],
  desk: [{ model: "desk" }],
  chair: [{ model: "chair" }],
  stool: [{ model: "stool" }],
  nightstand: [{ model: "nightstand" }],
  bathCabinet: [{ model: "bathCabinet" }],
  umbrellaStand: [{ model: "vase" }],
  laundryBasket: [{ model: "basket" }],
  car: [{ model: "car" }],
  toolBench: [{ model: "workbench" }],
  crate: [{ model: "box" }],
  bigCarton: [{ model: "box" }],
  // Garden.
  tree: [{ model: "tree" }],
  flowerBed: [{ model: "planter" }],
  flowers: [{ model: "flowers" }],
  gardenBench: [{ model: "bench" }],
  bush: [{ model: "bush" }],
  // Things to hide as.
  duck: [{ model: "duck" }],
  apple: [{ model: "apple" }],
  lemon: [{ model: "lemon" }],
  toyBall: [{ model: "football" }],
  smallPlant: [{ model: "succulent" }],
  wateringCan: [{ model: "wateringCan" }],
  stone: [{ model: "stone" }],
  stoneSmall: [{ model: "rock" }],
  paintCan: [{ model: "tin" }],
  carton: [{ model: "box" }],
  bucket: [{ model: "bucket" }],
  gnome: [{ model: "gnome" }],
  can: [{ model: "can" }],
  bottle: [{ model: "bleach" }],
  shampoo: [{ model: "cleaner" }],
  jar: [{ model: "jug" }],
  remote: [{ model: "gamepad" }],
};

export const MODEL_KEYS = [...new Set(Object.values(KIND_MODELS).flatMap((list) => list!.map((m) => m.model)))];

/** Whether a kind's part is drawn by a model (and so not as a shape). */
export function modelDraws(kind: PropKind, part: number): boolean {
  const list = KIND_MODELS[kind.id];
  return !!list?.some((m) => m.part === undefined || m.part === part);
}

/** The box a kind's parts fill, unturned, around its origin. */
export function kindBox(kind: PropKind): Box {
  const out: Box = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const part of kind.parts) {
    const b = partBox(part, { x: 0, y: 0, z: 0, turn: 0 });
    out.x0 = Math.min(out.x0, b.x0);
    out.y0 = Math.min(out.y0, b.y0);
    out.z0 = Math.min(out.z0, b.z0);
    out.x1 = Math.max(out.x1, b.x1);
    out.y1 = Math.max(out.y1, b.y1);
    out.z1 = Math.max(out.z1, b.z1);
  }
  return out;
}

/** Where a model sits within its piece (unturned): the bottom centre of the box it fills, and its stretch. */
export function modelFit(kind: PropKind, m: { model: ModelKey; part?: number }) {
  const box = m.part === undefined ? kindBox(kind) : partBox(kind.parts[m.part], { x: 0, y: 0, z: 0, turn: 0 });
  const [w, h, d] = modelSize(m.model);
  return {
    at: [(box.x0 + box.x1) / 2, box.y0, (box.z0 + box.z1) / 2] as [number, number, number],
    scale: [(box.x1 - box.x0) / w, (box.y1 - box.y0) / h, (box.z1 - box.z0) / d] as [number, number, number],
  };
}
