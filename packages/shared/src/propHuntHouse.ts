// "The Big House", greybox edition: the whole Prop Hunt map at final scale, built from plain
// boxes, cylinders and balls so the layout can be walked and timed before any art exists
// (Prop-hunt-plan.md, phase 1). The art pass replaces the looks, not the layout.
//
// Coordinates: x runs east, z south, y up. The layout below is drawn at 1:1 (the house is
// x 0…54, z 0…40, with the garage to its west and the garden to its south; walls are 0.6
// thick, centred on their line), then everything is scaled up by HOUSE_SCALE at the end.
import type { Area, Block, HouseMap, MapProp, PropKind, PropPart, Spot } from "./propHunt";

type V3 = [number, number, number];

const box = (w: number, h: number, d: number, color: string, at?: V3, pass?: boolean): PropPart => ({ shape: "box", size: [w, h, d], at, color, pass });
const cyl = (dia: number, h: number, color: string, at?: V3): PropPart => ({ shape: "cyl", size: [dia, h, dia], at, color });
const ball = (w: number, h: number, d: number, color: string, at?: V3, pass?: boolean): PropPart => ({ shape: "ball", size: [w, h, d], at, color, pass });

/** The same parts, made of `surface` (for the art; the greybox ignores it). */
const made = (surface: string, parts: PropPart[]): PropPart[] => parts.map((p) => ({ ...p, surface }));

/** Four legs under a w × d top, `inset` in from its edges. */
const legs = (w: number, d: number, h: number, inset: number, color: string, dia = 0.3): PropPart[] =>
  [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz]) => cyl(dia, h, color, [sx * (w / 2 - inset), 0, sz * (d / 2 - inset)]));

/** Open shelves: two sides, a back, and boards every `gap` (the bottom one on the floor). */
function shelves(w: number, d: number, h: number, gap: number, color: string): PropPart[] {
  const parts = [box(0.25, h, d, color, [-(w - 0.25) / 2, 0, 0]), box(0.25, h, d, color, [(w - 0.25) / 2, 0, 0]), box(w, h, 0.15, color, [0, 0, -(d - 0.15) / 2])];
  for (let y = 0; y < h - 0.5; y += gap) parts.push(box(w - 0.5, 0.2, d - 0.15, color, [0, y, 0.075]));
  parts.push(box(w, 0.2, d, color, [0, h - 0.2, 0]));
  return parts;
}

/** A box open at the top: floor and four walls. */
const tub = (w: number, h: number, d: number, wall: number, color: string): PropPart[] => [
  box(w, 0.3, d, color),
  box(w, h - 0.3, wall, color, [0, 0.3, -(d - wall) / 2]),
  box(w, h - 0.3, wall, color, [0, 0.3, (d - wall) / 2]),
  box(wall, h - 0.3, d - 2 * wall, color, [-(w - wall) / 2, 0.3, 0]),
  box(wall, h - 0.3, d - 2 * wall, color, [(w - wall) / 2, 0.3, 0]),
];

const WOOD = "#9b7650";
const DARK_WOOD = "#5e4632";
const FABRIC = "#6f8fa6";
const WHITE = "#f1efe9";

// Furniture. Pieces drawn with a Poly Haven model (see the web app's art/models.ts) are sized to
// that model's proportions, and their colliders follow its seat and table-top heights (measured
// by tools/models/src/propHunt.ts); the rest are built from parts, each made of something.
const furniture: Record<string, Omit<PropKind, "id" | "disguise">> = {
  // Models: Sofa_01, back at the rear, seat at 47% of its height, arms at 63%.
  sofa: {
    name: "Sofa",
    parts: [box(9, 2.15, 3.77, FABRIC), box(9, 2.41, 0.63, FABRIC, [0, 2.15, -1.57]), box(1.2, 0.75, 3.1, FABRIC, [-3.9, 2.15, 0.33]), box(1.2, 0.75, 3.1, FABRIC, [3.9, 2.15, 0.33])],
  },
  armchair: {
    name: "Armchair",
    parts: [box(4.4, 2.55, 3.99, "#b36b4f"), box(4.4, 2.99, 0.66, "#b36b4f", [0, 2.55, -1.66]), box(0.73, 0.85, 3.3, "#b36b4f", [-1.83, 2.55, 0.33]), box(0.73, 0.85, 3.3, "#b36b4f", [1.83, 2.55, 0.33])],
  },
  coffeeTable: { name: "Coffee table", parts: [...legs(5, 3.15, 1.44, 0.3, DARK_WOOD), box(5, 0.25, 3.15, WOOD, [0, 1.44, 0])] },
  // A low cabinet (modern_wooden_cabinet) with a television on it (Television_01).
  tvUnit: { name: "TV unit", parts: [box(7, 1.95, 1.49, DARK_WOOD), box(2.4, 1.84, 1.88, "#1d1f22", [0, 1.95, 0])] },
  bookshelf: { name: "Bookshelf", parts: made("oak", shelves(4.5, 1.4, 9.2, 2.2, WOOD)) },
  shelfUnit: { name: "Shelf unit", parts: made("metal", shelves(6, 2, 8.8, 2.2, "#8d949a")) },
  floorLamp: {
    name: "Floor lamp",
    parts: [...made("metal", [cyl(1.4, 0.2, "#3a3a3a"), cyl(0.25, 7, "#3a3a3a")]), { ...cyl(2.2, 1.6, "#efe3c4", [0, 7, 0]), surface: "fabric" }],
  },
  rug: { name: "Rug", parts: made("fabric", [box(10, 0.04, 7, "#b5654a")]) },
  smallRug: { name: "Rug", parts: made("fabric", [box(8, 0.04, 6, "#7d8fb3")]) },
  // potted_plant_02: the pot collides, the leaves don't.
  plantBig: { name: "Plant", parts: [cyl(2.2, 1.6, "#b5653e"), ball(3.2, 2.6, 3.02, "#4e8a47", [0, 1.24, 0], true)] },
  // dining_table: top at 93% of its height.
  diningTable: { name: "Dining table", parts: [...legs(8, 4.92, 2.81, 0.4, DARK_WOOD, 0.35), box(8, 0.3, 4.92, WOOD, [0, 2.81, 0])] },
  // painted_wooden_table, made desk-sized.
  desk: { name: "Desk", parts: [...legs(6, 2.84, 2.14, 0.3, "#555a60", 0.25), box(6, 0.25, 2.84, "#d8cfc0", [0, 2.14, 0])] },
  // dining_chair_02: seat at 45%, back along the rear.
  chair: { name: "Chair", parts: [...legs(2, 2.7, 1.78, 0.2, DARK_WOOD, 0.2), box(2, 0.25, 2.7, WOOD, [0, 1.78, 0]), box(2, 2.48, 0.45, WOOD, [0, 2.03, -1.125])] },
  // bar_chair_round_01.
  stool: { name: "Stool", parts: [cyl(1.4, 2.19, "#c8553d")] },
  counter: { name: "Counter", parts: [{ ...box(4, 3.9, 2.6, "#e9e4da", [0, 0, -0.1]), surface: "paint" }, { ...box(4, 0.2, 2.8, "#6b6460", [0, 3.9, 0]), surface: "marble" }] },
  sinkCounter: {
    name: "Sink",
    parts: [{ ...box(4, 3.9, 2.6, "#e9e4da", [0, 0, -0.1]), surface: "paint" }, { ...box(4, 0.2, 2.8, "#9aa3a8", [0, 3.9, 0]), surface: "marble" }, { ...cyl(0.25, 1.2, "#b9bfc4", [0, 4.1, -0.9]), surface: "metal" }],
  },
  fridge: { name: "Fridge", parts: made("enamel", [box(3.2, 8.2, 3, "#eef0ee")]) },
  wallShelf: { name: "Wall shelf", parts: made("oak", [box(6, 0.2, 1.2, WOOD)]) },
  trashBin: { name: "Bin", parts: made("metal", [box(2.4, 4, 2.4, "#6f7378")]) },
  bath: { name: "Bath", parts: made("ceramic", tub(7.5, 2.4, 3.4, 0.3, WHITE)) },
  toilet: { name: "Toilet", parts: made("ceramic", [cyl(1.6, 1.9, WHITE, [0, 0, 0.2]), box(1.9, 1.9, 0.8, WHITE, [0, 1.4, -1])]) },
  // painted_wooden_nightstand, as a bathroom cabinet.
  bathCabinet: { name: "Cabinet", parts: [box(3, 3.72, 3.06, "#dfe6e4")] },
  bed: {
    name: "Bed",
    parts: [
      ...made("oak", [...legs(4.5, 9, 1.2, 0.3, DARK_WOOD, 0.4), box(4.5, 0.4, 9, WOOD, [0, 1.2, 0]), box(4.5, 2.8, 0.3, WOOD, [0, 1.2, -4.35])]),
      ...made("fabric", [box(4.3, 0.9, 8.6, "#dfe7ee", [0, 1.6, 0.1]), box(3, 0.4, 1.2, WHITE, [0, 2.5, -3.4])]),
    ],
  },
  bigBed: {
    name: "Bed",
    parts: [
      ...made("oak", [...legs(7, 9.5, 1.2, 0.3, DARK_WOOD, 0.4), box(7, 0.4, 9.5, DARK_WOOD, [0, 1.2, 0]), box(7, 3.6, 0.3, DARK_WOOD, [0, 1.2, -4.6])]),
      ...made("fabric", [box(6.8, 1, 9.1, "#c9d3c2", [0, 1.6, 0.1]), box(2.8, 0.45, 1.3, WHITE, [-1.6, 2.6, -3.6]), box(2.8, 0.45, 1.3, WHITE, [1.6, 2.6, -3.6])]),
    ],
  },
  // ClassicNightstand_01.
  nightstand: { name: "Nightstand", parts: [box(2.2, 2.7, 1.62, WOOD)] },
  toyBox: { name: "Toy box", parts: made("paint", tub(3.5, 1.8, 2.2, 0.2, "#e0b04a")) },
  wardrobe: {
    name: "Wardrobe",
    parts: [
      ...made("oak", [
        box(6, 9.6, 0.2, WOOD, [0, 0, -1.3]),
        box(0.2, 9.6, 2.8, WOOD, [-2.9, 0, 0]),
        box(0.2, 9.6, 2.8, WOOD, [2.9, 0, 0]),
        box(6, 0.2, 2.8, WOOD, [0, 9.4, 0]),
        box(5.6, 0.4, 2.6, WOOD, [0, 0, 0.1]),
        box(5.6, 0.2, 2.6, WOOD, [0, 6.4, 0.1]),
      ]),
      ...made("fabric", [box(1.2, 3, 2, "#7b5ea7", [-1.8, 3.4, 0], true), box(1.2, 2.6, 2, "#4f7fa3", [-0.4, 3.8, 0], true), box(1.2, 3.2, 2, "#c9a24a", [1, 3.2, 0], true)]),
    ],
  },
  shoeRack: {
    name: "Shoe rack",
    parts: made("oak", [box(0.2, 2.4, 1.6, WOOD, [-1.9, 0, 0]), box(0.2, 2.4, 1.6, WOOD, [1.9, 0, 0]), box(3.6, 0.15, 1.5, WOOD, [0, 0.6, 0]), box(3.6, 0.15, 1.5, WOOD, [0, 1.8, 0]), box(4, 0.2, 1.6, WOOD, [0, 2.2, 0])]),
  },
  coatStand: { name: "Coat stand", parts: [...made("oak", [cyl(1.4, 0.2, DARK_WOOD), cyl(0.4, 8, DARK_WOOD)]), { ...ball(1.6, 3, 1.4, "#8a4b3c", [0, 4.6, 0.3], true), surface: "fabric" }] },
  // ceramic_vase_03, as an umbrella stand.
  umbrellaStand: { name: "Umbrella stand", parts: [cyl(1, 3.7, "#3d5a6c")] },
  // wicker_basket_02.
  laundryBasket: { name: "Laundry basket", parts: [box(2.4, 1.37, 1.71, "#d9c7a0")] },
  // covered_car: a car under a dust sheet, solid to the floor.
  car: { name: "Car", parts: [box(8.17, 4.3, 20, "#b3433b"), box(7.4, 2.14, 10, "#2b3036", [0, 4.3, 0])] },
  // WoodenTable_03, a workbench; top at 97% of its height.
  toolBench: { name: "Workbench", parts: [...legs(7, 3.05, 3.9, 0.3, "#555a60"), box(7, 0.35, 3.05, WOOD, [0, 3.9, 0])] },
  // cardboard_box_01, at two sizes (the small one is a step up to the workbench).
  crate: { name: "Box", parts: [box(2.52, 2.2, 3.36, "#b08a5a")] },
  bigCarton: { name: "Box", parts: [box(3.44, 3, 4.59, "#c7a274")] },
  bicycle: {
    name: "Bicycle",
    parts: [...made("rubber", [box(0.2, 3, 3, "#2d2d2d", [0, 0, -2.4]), box(0.2, 3, 3, "#2d2d2d", [0, 0, 2.4])]), { ...box(0.25, 0.3, 5, "#3b78a8", [0, 2.6, 0]), surface: "paint" }],
  },
  // tree_small_02: the trunk stops you; you can walk under the leaves.
  tree: { name: "Tree", parts: [box(12.67, 20, 18.35, "#4f7d3e")] },
  // planter_box_02, with periwinkle growing in it (flowers: you walk through them).
  flowerBed: { name: "Planter", parts: [box(8, 2.88, 3, "#6a4a35")] },
  flowers: { name: "Flowers", parts: [box(7, 2.3, 1.8, "#9b6bd1", undefined, true)] },
  // painted_wooden_bench.
  gardenBench: { name: "Bench", parts: [box(5.3, 4.07, 2.29, WOOD)] },
  // shrub_02: thick enough to hide behind.
  bush: { name: "Bush", parts: [box(12, 3.37, 4.54, "#4f7d3e")] },
  wheelbarrow: {
    name: "Wheelbarrow",
    parts: [
      { ...box(3, 1.4, 4, "#4f8f6a", [0, 1.4, 0]), surface: "paint" },
      { ...box(0.4, 1.4, 1.4, "#222222", [0, 0, 2.4]), surface: "rubber" },
      ...made("metal", [box(0.3, 1.4, 0.3, "#555a60", [-1.2, 0, -1.6]), box(0.3, 1.4, 0.3, "#555a60", [1.2, 0, -1.6])]),
    ],
  },
};

// Things to hide as. Ones drawn with a Poly Haven model (web app: art/models.ts) are a single
// box in that model's proportions; the rest are built from parts, each made of something. A
// disguise is drawn exactly like the real thing, so it blends in.
const disguises: Record<string, Omit<PropKind, "id" | "disguise">> = {
  mug: { name: "Mug", parts: made("ceramic", [cyl(0.4, 0.45, "#f3efe6"), box(0.08, 0.25, 0.22, "#f3efe6", [0.24, 0.1, 0])]) },
  mugRed: { name: "Red mug", parts: made("ceramic", [cyl(0.4, 0.45, "#c0503f"), box(0.08, 0.25, 0.22, "#c0503f", [0.24, 0.1, 0])]) },
  mugBlue: { name: "Blue mug", parts: made("ceramic", [cyl(0.4, 0.45, "#4b6d9b"), box(0.08, 0.25, 0.22, "#4b6d9b", [0.24, 0.1, 0])]) },
  bookRed: { name: "Red book", parts: made("cloth", [box(0.25, 1.05, 0.75, "#a8433a")]) },
  bookBlue: { name: "Blue book", parts: made("cloth", [box(0.25, 1.05, 0.75, "#3d5f8f")]) },
  bookGreen: { name: "Green book", parts: made("cloth", [box(0.25, 1.05, 0.75, "#4f7a52")]) },
  bookYellow: { name: "Yellow book", parts: made("cloth", [box(0.25, 1.05, 0.75, "#d6a73e")]) },
  bookFlat: { name: "Book", parts: made("cloth", [box(0.75, 0.25, 1.05, "#6b4f8a")]) },
  shoe: { name: "Shoe", parts: [{ ...box(0.5, 0.12, 1.25, "#2b2420"), surface: "rubber" }, ...made("leather", [box(0.5, 0.23, 1.25, "#5b4636", [0, 0.12, 0]), box(0.5, 0.25, 0.6, "#5b4636", [0, 0.35, -0.3])])] },
  sneaker: { name: "Sneaker", parts: [{ ...box(0.5, 0.12, 1.25, "#f2efe9"), surface: "rubber" }, ...made("fabric", [box(0.5, 0.23, 1.25, "#ece8e0", [0, 0.12, 0]), box(0.5, 0.25, 0.6, "#c8553d", [0, 0.35, -0.3])])] },
  slipper: { name: "Slipper", parts: made("fabric", [box(0.45, 0.2, 1.1, "#d98aa0")]) },
  // jug_01.
  jar: { name: "Jug", parts: [box(0.6, 0.45, 0.36, "#d6a24e")] },
  // food_apple_01, lemon.
  apple: { name: "Apple", parts: [box(0.38, 0.34, 0.38, "#c8372d")] },
  lemon: { name: "Lemon", parts: [box(0.36, 0.51, 0.36, "#e8c22c")] },
  cereal: { name: "Cereal box", parts: made("paint", [box(1.2, 1.6, 0.4, "#e6c34a")]) },
  // can_rusted, bleach_bottle, all_purpose_cleaner.
  can: { name: "Can", parts: [box(0.3, 0.375, 0.3, "#c23b33")] },
  bottle: { name: "Bottle", parts: [box(0.34, 1.1, 0.23, "#3e7a4d")] },
  shampoo: { name: "Spray bottle", parts: [box(0.4, 0.8, 0.3, "#7fb3c9")] },
  toiletRoll: { name: "Toilet roll", parts: made("fabric", [cyl(0.5, 0.48, "#f5f3ee")]) },
  towel: { name: "Towel", parts: made("fabric", [box(1.2, 0.4, 0.9, "#8fb8a8")]) },
  sponge: { name: "Sponge", parts: made("fabric", [box(0.45, 0.2, 0.3, "#e9d34a")]) },
  // rubber_duck_toy.
  duck: { name: "Rubber duck", parts: [box(0.5, 0.69, 0.71, "#f2c94c")] },
  blockRed: { name: "Red block", parts: made("paint", [box(0.5, 0.5, 0.5, "#c8453a")]) },
  blockBlue: { name: "Blue block", parts: made("paint", [box(0.5, 0.5, 0.5, "#3f6fb0")]) },
  blockYellow: { name: "Yellow block", parts: made("paint", [box(0.5, 0.5, 0.5, "#e8b931")]) },
  dice: { name: "Dice", parts: made("plastic", [box(0.3, 0.3, 0.3, "#f4f1ea")]) },
  // football.
  toyBall: { name: "Football", parts: [box(0.9, 0.39, 0.39, "#8a5a3c")] },
  toyCar: {
    name: "Toy car",
    parts: [
      ...made("paint", [box(0.5, 0.3, 0.9, "#3f6fb0", [0, 0.1, 0]), box(0.42, 0.2, 0.45, "#3f6fb0", [0, 0.4, -0.05])]),
      ...made("rubber", [box(0.56, 0.18, 0.18, "#222222", [0, 0, -0.28]), box(0.56, 0.18, 0.18, "#222222", [0, 0, 0.28])]),
    ],
  },
  teddy: {
    name: "Teddy bear",
    parts: made("fabric", [ball(0.7, 0.75, 0.6, "#9a6a43"), ball(0.55, 0.5, 0.5, "#9a6a43", [0, 0.68, 0]), ball(0.18, 0.18, 0.12, "#9a6a43", [-0.2, 1.08, 0]), ball(0.18, 0.18, 0.12, "#9a6a43", [0.2, 1.08, 0])]),
  },
  cushion: { name: "Cushion", parts: made("fabric", [box(1.8, 0.55, 1.8, "#c9894a")]) },
  cushionBlue: { name: "Blue cushion", parts: made("fabric", [box(1.8, 0.55, 1.8, "#4f6f9a")]) },
  // gamepad.
  remote: { name: "Gamepad", parts: [box(0.7, 0.06, 0.75, "#2a2c30")] },
  // potted_plant_04, watering_can_metal_01, stone_01, rock_09.
  smallPlant: { name: "Pot plant", parts: [box(0.8, 1.27, 0.85, "#4e8a47")] },
  wateringCan: { name: "Watering can", parts: [box(0.6, 0.63, 1.42, "#8d949a")] },
  stone: { name: "Stone", parts: [box(0.9, 0.42, 0.54, "#8f8c86")] },
  stoneSmall: { name: "Pebble", parts: [box(0.35, 0.15, 0.7, "#a19d95")] },
  // cleaner_tin_01, cardboard_box_01, wooden_bucket_01, garden_gnome.
  paintCan: { name: "Tin", parts: [box(0.75, 1.08, 0.75, "#c9ccd0")] },
  carton: { name: "Box", parts: [box(1.2, 1.05, 1.6, "#c7a274")] },
  bucket: { name: "Bucket", parts: [box(1, 1.49, 0.92, "#8a6a4a")] },
  gnome: { name: "Garden gnome", parts: [box(0.6, 1.38, 0.48, "#3e6fb0")] },
};

const kinds: Record<string, PropKind> = {};
for (const [id, k] of Object.entries(furniture)) kinds[id] = { id, ...k, disguise: false };
for (const [id, k] of Object.entries(disguises)) kinds[id] = { id, ...k, disguise: true };

// --- Building blocks --------------------------------------------------------------------

/** The whole property, furniture and props included, is scaled up by this once it's laid out. */
export const HOUSE_SCALE = 1.3;
/** First-floor height (in the layout below, before scaling). */
const LAYOUT_UPSTAIRS = 11.6;
/** First-floor height in the world: the top of the slab between the floors. */
export const UPSTAIRS = LAYOUT_UPSTAIRS * HOUSE_SCALE;
const WALL = "#e9e1d3";
const FENCE = "#a07a52";
const T = 0.3;
/** Doors are this tall; the wall above them is a lintel. */
const DOOR_H = 9;

const blocks: Block[] = [];
const props: MapProp[] = [];

function blk(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string | null, shadow = true, surface?: string) {
  blocks.push({ x0, y0, z0, x1, y1, z1, color, shadow, surface });
}

/** A wall along z at `x`, with doorways [from, to] along it. */
function wallX(x: number, z0: number, z1: number, y0: number, y1: number, doors: [number, number][] = [], color = WALL, surface = "plaster") {
  let z = z0 - T;
  for (const [a, b] of doors) {
    blk(x - T, y0, z, x + T, y1, a, color, true, surface);
    if (y0 + DOOR_H < y1) blk(x - T, y0 + DOOR_H, a, x + T, y1, b, color, true, surface);
    z = b;
  }
  blk(x - T, y0, z, x + T, y1, z1 + T, color, true, surface);
}

/** A wall along x at `z`, with doorways [from, to] along it. */
function wallZ(z: number, x0: number, x1: number, y0: number, y1: number, doors: [number, number][] = [], color = WALL, surface = "plaster") {
  let x = x0 - T;
  for (const [a, b] of doors) {
    blk(x, y0, z - T, a, y1, z + T, color, true, surface);
    if (y0 + DOOR_H < y1) blk(a, y0 + DOOR_H, z - T, b, y1, z + T, color, true, surface);
    x = b;
  }
  blk(x, y0, z - T, x1 + T, y1, z + T, color, true, surface);
}

function put(kind: string, x: number, y: number, z: number, turn = 0) {
  if (!kinds[kind]) throw new Error(`Unknown prop kind: ${kind}`);
  props.push({ id: props.length, kind, x, y, z, turn });
}

/** The same prop in a row from (x, z), `step` apart along x (or z). */
function row(kind: string | string[], n: number, x: number, y: number, z: number, step: number, alongZ = false, turn = 0) {
  for (let i = 0; i < n; i++) {
    const k = Array.isArray(kind) ? kind[i % kind.length] : kind;
    put(k, alongZ ? x : x + i * step, y, alongZ ? z + i * step : z, turn);
  }
}

const F = LAYOUT_UPSTAIRS;
const BOOKS = ["bookRed", "bookBlue", "bookGreen", "bookYellow"];

// --- Floors -----------------------------------------------------------------------------

blk(-80, -0.8, -40, 110, -0.4, 120, "#86a866", false, "grass"); // beyond the fence
blk(0, -0.4, 0, 22, 0, 24, "#b98c5e", false, "living"); // living room
blk(22, -0.4, 0, 32, 0, 40, "#cfc6b8", false, "hall"); // hall
blk(32, -0.4, 0, 54, 0, 40, "#d8d2c4", false, "kitchen"); // kitchen
blk(0, -0.4, 24, 12, 0, 40, "#e6eef0", false, "bathroom"); // bathroom
blk(12, -0.4, 24, 22, 0, 40, "#a77b52", false, "study"); // study
blk(-22, -0.4, 0, 0, 0, 24, "#9a9a96", false, "garage"); // garage
blk(-22, -0.4, 24, 0, 0, 40, "#b4ada2", false, "path"); // side path
blk(-22, -0.4, 40, 54, 0, 76, "#6f9a4f", false, "grass"); // garden

// The first floor, with the stairwell (x 22…27, z 6…26) left open.
blk(0, 11, 0, 22, F, 40, "#c9a77c", false, "kids"); // kids' bedroom
blk(22, 11, 0, 27, F, 6, "#cfc6b8", false, "hall");
blk(22, 11, 26, 27, F, 40, "#cfc6b8", false, "hall");
blk(27, 11, 0, 32, F, 40, "#cfc6b8", false, "hall"); // landing
blk(32, 11, 0, 54, F, 40, "#9c7f63", false, "bedroom"); // main bedroom
blk(-22, 11, 0, 0, F, 24, "#8d8780", false, "garage"); // garage roof

// Stairs: 20 steps up the hall's west side, rising southwards.
const RISE = F / 20;
for (let i = 0; i < 20; i++) blk(22 + T, 0, 6 + i, 27, RISE * (i + 1), 7 + i, "#a8835e", true, "oak");
blk(27 - 0.15, F, 6, 27 + 0.15, F + 2.6, 26, WOOD, true, "oak"); // banister along the stairwell
blk(22 + T, F, 6 - 0.15, 27 + 0.15, F + 2.6, 6 + 0.15, WOOD, true, "oak");

// --- Walls ------------------------------------------------------------------------------

// Ground floor, outside.
wallZ(0, -22, 54, 0, 11);
wallX(54, 0, 40, 0, 11);
wallZ(40, 0, 54, 0, 11, [[27, 32]]); // back door → garden
wallX(-22, 0, 24, 0, 11);
wallX(0, 24, 40, 0, 11);
// Ground floor, inside.
wallX(0, 0, 24, 0, 11, [[16, 21]]); // garage ↔ living room
wallZ(24, -22, 0, 0, 11, [[-14, -6]]); // garage → side path
wallX(22, 0, 24, 0, 11, [[0.6, 5.4]]); // living room ↔ hall
wallX(22, 24, 40, 0, 11, [[30, 35]]); // study ↔ hall
wallZ(24, 0, 22, 0, 11, [[15, 20]]); // living room ↔ study (the bathroom's side is solid)
wallX(12, 24, 40, 0, 11, [[33, 38]]); // bathroom ↔ study
wallX(32, 0, 40, 0, 11, [[10, 15], [29, 34]]); // hall ↔ kitchen
// First floor.
wallZ(0, 0, 54, F, 22);
wallZ(40, 0, 54, F, 22);
wallX(0, 0, 40, F, 22);
wallX(54, 0, 40, F, 22);
wallX(22, 0, 40, F, 22, [[30, 35]]); // landing ↔ kids' bedroom
wallX(32, 0, 40, F, 22, [[30, 35]]); // landing ↔ main bedroom

// Garden fence and shed.
wallZ(76, -22, 54, 0, 6, [], FENCE, "planks");
wallX(54, 40, 76, 0, 6, [], FENCE, "planks");
wallX(-22, 24, 76, 0, 6, [], FENCE, "planks");
wallZ(62, 40, 52, 0, 9, [[44, 49]], "#8a6a4a", "planks");
wallZ(74, 40, 52, 0, 9, [], "#8a6a4a", "planks");
wallX(40, 62, 74, 0, 9, [], "#8a6a4a", "planks");
wallX(52, 62, 74, 0, 9, [], "#8a6a4a", "planks");
blk(39.4, 9, 61.4, 52.6, 9.5, 74.6, "#5c4a3a", true, "planks");
// Stepping stones from the back door to the shed.
for (let i = 0; i < 8; i++) {
  const x = 29.5 + (17 * i) / 7;
  const z = 42 + (18 * i) / 7;
  blk(x - 1.2, 0, z - 1, x + 1.2, 0.06, z + 1, "#b4ada2", false, "path");
}

// Invisible bounds, far above anything climbable.
blk(-40, -1, -20, -22.3, 80, 100, null);
blk(54.3, -1, -20, 80, 80, 100, null);
blk(-40, -1, -40, 80, 80, -0.3, null);
blk(-40, -1, 76.3, 80, 80, 100, null);

// --- Living room (x 0…22, z 0…24) ---------------------------------------------------------

put("rug", 11, 0, 12);
put("sofa", 8, 0, 21.5, 2);
put("coffeeTable", 8, 0, 15);
put("tvUnit", 8, 0, 1.2);
put("armchair", 17, 0, 12, 3);
put("bookshelf", 1, 0, 6.25, 1);
put("floorLamp", 20.5, 0, 22.5);
put("plantBig", 2, 0, 2);
row(BOOKS, 6, 1.2, 2.4, 4.6, 0.32, true, 1);
row([...BOOKS].reverse(), 5, 1.2, 4.6, 4.6, 0.32, true, 1);
put("jar", 1.1, 4.6, 7.4);
row(BOOKS, 4, 1.2, 6.8, 4.6, 0.32, true, 1);
put("smallPlant", 1.1, 6.8, 7.6);
put("blockRed", 14, 0, 4);
put("blockBlue", 14.6, 0, 4.3);
put("blockYellow", 14.2, 0.5, 4.1);
put("blockYellow", 13.6, 0, 3.4);
put("toyCar", 13, 0, 6.5, 1);
put("toyCar", 15.5, 0, 7);
put("toyBall", 18, 0, 5);
put("teddy", 17.3, 2.55, 12, 3);
put("cushion", 5.8, 2.15, 21.3, 2);
put("cushionBlue", 8, 2.15, 21.3, 2);
put("cushion", 10.2, 2.15, 21.3, 2);
put("mug", 7, 1.69, 15);
put("mugRed", 9, 1.69, 14.6);
put("remote", 8, 1.69, 15.6);
put("slipper", 3.2, 0, 17);
put("slipper", 3.8, 0, 17.2);
put("smallPlant", 11.2, 1.95, 1.6);

// --- Hall (x 22…32, z 0…40) ---------------------------------------------------------------

put("shoeRack", 31, 0, 3, 3);
row(["shoe", "shoe", "shoe", "sneaker", "sneaker"], 5, 31, 0.75, 1.6, 0.7, true, 3);
row("slipper", 4, 31, 1.95, 1.8, 0.8, true, 3);
put("shoe", 29, 0, 6, 2);
put("sneaker", 29.6, 0, 6.3, 2);
put("coatStand", 31, 0, 8);
put("umbrellaStand", 28.2, 0, 1.3);
put("carton", 24, 0, 30);
put("carton", 25.2, 0, 31.2, 1);
put("carton", 24.2, 1.05, 30.2);
put("toyBall", 25, 0, 36);

// --- Kitchen (x 32…54, z 0…40) ------------------------------------------------------------

for (const z of [2.3, 6.3, 14.3, 18.3]) put("counter", 52.3, 0, z, 3);
put("sinkCounter", 52.3, 0, 10.3, 3);
for (const x of [36.3, 40.3, 44.3, 48.3]) put("counter", x, 0, 1.7);
put("fridge", 52.2, 0, 22, 3);
put("stool", 40, 0, 4.4);
put("wallShelf", 38, 6, 0.9);
put("wallShelf", 38, 8.2, 0.9);
put("wallShelf", 46, 6, 0.9);
put("wallShelf", 46, 8.2, 0.9);
put("wallShelf", 53.1, 6, 17.3, 3);
row(["mug", "mug", "mug", "mugBlue", "mugRed", "mug"], 6, 35.8, 6.2, 0.9, 0.8);
row("jar", 3, 36, 8.4, 0.9, 1);
put("bottle", 39.5, 8.4, 0.9);
row("can", 3, 43.6, 6.2, 0.9, 0.6);
put("cereal", 46.5, 6.2, 0.9);
put("cereal", 47.9, 6.2, 0.9);
row("jar", 5, 44, 8.4, 0.9, 0.8);
row(["can", "can", "bottle"], 3, 53.1, 6.2, 15.5, 0.8, true);
put("cereal", 52.2, 8.2, 22, 3);
put("bottle", 52.6, 4.1, 15);
put("bottle", 52.6, 4.1, 15.6);
put("sponge", 52.3, 4.1, 10.8);
put("mugBlue", 44, 4.1, 2);
put("diningTable", 42, 0, 30);
put("chair", 40, 0, 26);
put("chair", 44, 0, 26);
put("chair", 40, 0, 34, 2);
put("chair", 44, 0, 34, 2);
put("chair", 36.5, 0, 30, 1);
put("chair", 47.5, 0, 30, 3);
put("apple", 41, 3.11, 29.6);
put("apple", 41.5, 3.11, 30.2);
put("apple", 40.6, 3.11, 30.4);
put("lemon", 41.1, 3.11, 30.9);
put("mug", 44, 3.11, 29);
put("jar", 43, 3.11, 31);
put("trashBin", 34.5, 0, 38);

// --- Bathroom (x 0…12, z 24…40) -----------------------------------------------------------

put("bath", 4.3, 0, 37.9);
put("toilet", 10.2, 0, 27, 3);
put("bathCabinet", 1.83, 0, 27, 1);
row("shampoo", 3, 2, 2.4, 39.45, 0.6);
put("duck", 6.5, 2.4, 39.2);
put("duck", 5, 0.3, 37.6);
put("sponge", 3.5, 0.3, 37.4);
put("toiletRoll", 11, 0, 29.2);
put("toiletRoll", 11, 0.48, 29.2);
put("toiletRoll", 11.2, 0, 29.8);
put("toiletRoll", 1.83, 3.72, 26.2);
put("towel", 1.83, 3.72, 27.8, 1);
put("towel", 6, 0, 25.3);
put("towel", 6, 0.4, 25.3);

// --- Study (x 12…22, z 24…40) -------------------------------------------------------------

put("desk", 17, 0, 38.2, 2);
put("chair", 17, 0, 35);
put("bookshelf", 13, 0, 27.25, 1);
row(BOOKS, 7, 13.2, 2.4, 25.5, 0.32, true, 1);
row([...BOOKS].reverse(), 6, 13.2, 4.6, 25.5, 0.32, true, 1);
row(BOOKS, 3, 13.2, 6.8, 25.5, 0.32, true, 1);
put("bookFlat", 15.5, 2.39, 38.5);
put("mug", 18.5, 2.39, 38);
put("carton", 20.9, 0, 25.5);
put("carton", 20.9, 1.05, 25.5, 1);
put("bookFlat", 15, 0, 26);
put("bookFlat", 15, 0.25, 26, 1);

// --- Garage (x −22…0, z 0…24): the seekers start here --------------------------------------

put("car", -15, 0, 11);
put("toolBench", -1.83, 0, 9, 3);
put("crate", -4.6, 0, 7, 1);
put("shelfUnit", -18.5, 0, 22.7, 2);
put("bigCarton", -3, 0, 21.4);
put("bigCarton", -3, 3, 21.4);
put("bicycle", -6.5, 0, 13);
row("paintCan", 3, -2, 4.24, 6.2, 0.9, true);
put("paintCan", -2.6, 4.24, 6.65);
put("bottle", -2, 4.24, 11.5);
row("paintCan", 4, -20.5, 2.4, 22.8, 1);
row(["carton", "paintCan", "bucket"], 3, -20.5, 4.6, 22.8, 1.5);
put("carton", -7, 0, 22.5);
put("carton", -8.4, 0, 22.6, 1);
put("bucket", -9, 0, 2);

// --- Side path and garden ----------------------------------------------------------------

put("trashBin", -19, 0, 30);
put("trashBin", -19, 0, 33.5);
row(["stone", "stoneSmall"], 4, -14, 0, 36, 1.2);
put("tree", -12, 0, 66);
put("tree", 28, 0, 58);
put("flowerBed", 10, 0, 43.5);
put("flowerBed", 44, 0, 43.5);
put("flowers", 10, 2.3, 43.5);
put("flowers", 44, 2.3, 43.5);
// Bushes along the fence: cover to hide behind.
put("bush", 2, 0, 73.4);
put("bush", -14, 0, 73.4);
put("bush", 51.6, 0, 52, 1);
put("bush", -19.6, 0, 52, 1);
put("gardenBench", 16, 0, 73, 2);
put("wheelbarrow", 36, 0, 66, 1);
for (const [x, z] of [
  [2, 48],
  [3, 48.8],
  [2.6, 50],
  [4.2, 49.5],
  [-6, 52],
  [-5, 52.6],
  [22, 70],
  [23.2, 70.4],
]) put(x % 2 === 0 ? "stone" : "stoneSmall", x, 0, z);
put("smallPlant", 33.5, 0, 41.2);
put("smallPlant", 34.3, 0, 41.8);
put("smallPlant", 25, 0, 41.2);
put("gnome", 12, 0, 46);
put("gnome", 8, 0, 47.3, 1);
put("gnome", 46, 0, 47, 3);
put("wateringCan", 47.5, 0, 46.5, 1);
put("toyBall", 20, 0, 55);
put("bucket", 38, 0, 64);
// Inside the shed (x 40…52, z 62…74).
put("shelfUnit", 46, 0, 72.7, 2);
row("paintCan", 3, 44, 2.4, 72.8, 1);
row(["wateringCan", "carton"], 2, 46.5, 4.6, 72.6, 1.4, false, 1);
put("crate", 41.8, 0, 66);
put("carton", 50.5, 0, 64);
put("carton", 50.5, 1.05, 64, 1);
put("wateringCan", 44, 0, 70);

// --- First floor: kids' bedroom (x 0…22) ----------------------------------------------------

put("bed", 4.8, F, 6, 1);
put("bed", 4.8, F, 16, 1);
put("nightstand", 1.4, F, 11, 1);
put("toyBox", 16, F, 3);
put("desk", 17, F, 37.6, 2);
put("chair", 17, F, 34.5);
put("bookshelf", 21, F, 22, 3);
put("smallRug", 11, F, 25);
row(BOOKS, 6, 20.8, F + 2.4, 20.2, 0.32, true, 3);
row(["blockRed", "blockBlue", "dice"], 4, 20.8, F + 4.6, 20.4, 0.7, true, 3);
put("blockRed", 8, F, 24);
put("blockBlue", 8.6, F, 24.3);
put("blockYellow", 9.2, F, 23.8);
put("blockRed", 8.3, F + 0.5, 24.1);
put("blockYellow", 12, F, 28);
put("blockBlue", 12.4, F, 28.6);
put("toyCar", 6, F, 27, 1);
put("toyCar", 14, F, 22);
put("toyBall", 15, F, 30);
put("toyBall", 3, F, 35);
put("teddy", 2.5, F + 2.5, 6, 1);
put("teddy", 2.5, F + 2.5, 16, 1);
put("teddy", 19, F, 8);
put("dice", 15.3, F + 0.3, 2.6);
put("dice", 16.4, F + 0.3, 3.3);
put("dice", 16.9, F + 0.3, 2.5);
put("blockBlue", 15.6, F + 0.3, 3.4);
put("bookFlat", 15.5, F + 2.39, 38.2);
put("mugRed", 18.8, F + 2.39, 38);

// --- First floor: landing (x 22…32) ---------------------------------------------------------

put("plantBig", 30.5, F, 38.3);
put("laundryBasket", 24.5, F, 38);
put("towel", 24.5, F + 1.37, 38);
put("smallPlant", 30.8, F, 1.2);
put("toyBall", 29, F, 33);

// --- First floor: main bedroom (x 32…54) ----------------------------------------------------

put("bigBed", 48.95, F, 14, 3);
put("nightstand", 52.6, F, 8.2, 3);
put("nightstand", 52.6, F, 19.8, 3);
put("wardrobe", 40, F, 1.7);
put("rug", 42, F, 14);
put("armchair", 36, F, 30, 1);
put("slipper", 42.8, F, 12.2, 1);
put("slipper", 42.8, F, 13, 1);
put("slipper", 36, F, 6);
put("slipper", 36.6, F, 6.1);
put("cushion", 51, F + 2.6, 12.4, 3);
put("cushionBlue", 51, F + 2.6, 15.6, 3);
put("bookFlat", 52.6, F + 2.7, 8.2, 3);
put("mug", 52.4, F + 2.7, 19.4);
put("smallPlant", 52.6, F + 2.7, 20.4);
put("shoe", 38.8, F + 0.4, 2);
put("shoe", 39.5, F + 0.4, 2);
put("sneaker", 40.5, F + 0.4, 2);
put("carton", 41.9, F + 0.4, 1.9);
put("carton", 38.5, F + 6.6, 1.7);
put("bookFlat", 40.5, F + 6.6, 1.7);
put("teddy", 36.3, F + 2.55, 30, 1);

const areas: Area[] = [
  { name: "Living room", x0: 0, y0: -1, z0: 0, x1: 22, y1: 11, z1: 24 },
  { name: "Hallway", x0: 22, y0: -1, z0: 0, x1: 32, y1: F - 0.01, z1: 40 },
  { name: "Kitchen", x0: 32, y0: -1, z0: 0, x1: 54, y1: 11, z1: 40 },
  { name: "Bathroom", x0: 0, y0: -1, z0: 24, x1: 12, y1: 11, z1: 40 },
  { name: "Study", x0: 12, y0: -1, z0: 24, x1: 22, y1: 11, z1: 40 },
  { name: "Garage", x0: -22, y0: -1, z0: 0, x1: 0, y1: 11, z1: 24 },
  { name: "Side path", x0: -22, y0: -1, z0: 24, x1: 0, y1: 40, z1: 40 },
  { name: "Shed", x0: 40, y0: -1, z0: 62, x1: 52, y1: 9, z1: 74 },
  { name: "Garden", x0: -22, y0: -1, z0: 40, x1: 54, y1: 40, z1: 76 },
  { name: "Kids' bedroom", x0: 0, y0: 11, z0: 0, x1: 22, y1: 40, z1: 40 },
  { name: "Landing", x0: 22, y0: F - 0.01, z0: 0, x1: 32, y1: 40, z1: 40 },
  { name: "Main bedroom", x0: 32, y0: 11, z0: 0, x1: 54, y1: 40, z1: 40 },
];

const hiderSpawns: Spot[] = [
  { x: 11, y: 0, z: 8 },
  { x: 42, y: 0, z: 20 },
  { x: 16, y: 0, z: 31 },
  { x: 11, y: F, z: 30 },
  { x: 40, y: F, z: 24 },
  { x: 14, y: 0, z: 58 },
];

/** Every position and size multiplied by `k`. */
function scaled(map: HouseMap, k: number): HouseMap {
  const box = <B extends { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }>(b: B): B => ({
    ...b,
    x0: b.x0 * k,
    y0: b.y0 * k,
    z0: b.z0 * k,
    x1: b.x1 * k,
    y1: b.y1 * k,
    z1: b.z1 * k,
  });
  const v = (a: [number, number, number]): [number, number, number] => [a[0] * k, a[1] * k, a[2] * k];
  const spot = (p: Spot): Spot => ({ x: p.x * k, y: p.y * k, z: p.z * k });
  return {
    ...map,
    kinds: Object.fromEntries(
      Object.entries(map.kinds).map(([id, kind]) => [id, { ...kind, parts: kind.parts.map((part) => ({ ...part, size: v(part.size), at: part.at && v(part.at) })) }]),
    ),
    blocks: map.blocks.map(box),
    props: map.props.map((p) => ({ ...p, x: p.x * k, y: p.y * k, z: p.z * k })),
    grass: map.grass.map((g) => ({ x0: g.x0 * k, z0: g.z0 * k, x1: g.x1 * k, z1: g.z1 * k })),
    areas: map.areas.map(box),
    stairs: map.stairs.map(box),
    hiderSpawns: map.hiderSpawns.map(spot),
    seekerSpawn: spot(map.seekerSpawn),
  };
}

export const BIG_HOUSE: HouseMap = scaled(
  {
    id: "big-house",
    kinds,
    blocks,
    props,
    grass: [
      { x0: -20, z0: 42, x1: -4, z1: 58 },
      { x0: 18, z0: 62, x1: 34, z1: 74 },
      { x0: 0, z0: 64, x1: 12, z1: 75 },
    ],
    areas,
    stairs: [{ x0: 22 + T, y0: 0, z0: 6, x1: 27, y1: F, z1: 26, up: "+z" }],
    hiderSpawns,
    seekerSpawn: { x: -8, y: 0, z: 6 },
  },
  HOUSE_SCALE,
);

/** Which room a point is in, for the HUD ("Kitchen"). */
export function areaAt(map: HouseMap, x: number, y: number, z: number): string | null {
  for (const a of map.areas) if (x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1 && z >= a.z0 && z < a.z1) return a.name;
  return null;
}
