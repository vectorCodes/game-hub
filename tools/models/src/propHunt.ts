// Prop Hunt's art (see Prop-hunt-plan.md, the art pass): downloads CC0 textures, the sky and
// models from Poly Haven, shrinks them for the web, and writes them under
// apps/web/public/prop-hunt/. Files already there are kept, so re-running only fetches what's
// new. Run with `pnpm --filter @shadow/models prop-hunt`.
//
// Models are stood on their base (origin at the bottom centre, facing +z as Poly Haven exports
// them), meshopt-compressed, and measured: their size and solid shape go to the web app
// (art/models.json), whose colliders are built from that shape, so what you see is what you
// bump into.
//
// Everything is sized for a game, not a film: models are simplified to a triangle budget by how
// big they are (Poly Haven's are made for close-ups; a stone had 50,000 triangles), and every
// image is re-encoded as WebP at the size it's seen at.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger, NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { center, dedup, getBounds, prune, quantize, reorder, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = join(ROOT, "apps/web/public/prop-hunt");
const RAW = join(ROOT, "assets/raw/prop-hunt");
const SIZES = join(ROOT, "apps/web/src/games/prop-hunt/art/models.json");
/** The solid shape is measured on a grid of this many columns each way (small things need fewer). */
const GRID = 8;
const SMALL_GRID = 4;
/** Things smaller than this (metres, across) are small. */
const SMALL = 0.6;
const API = "https://api.polyhaven.com";
const HEADERS = { "User-Agent": "GameHub-PropHunt/1.0 (asset pipeline)" };

/** Surfaces of the house, by the key the web app uses → the Poly Haven texture. */
export const TEXTURES: Record<string, string> = {
  living: "herringbone_parquet",
  kids: "plank_flooring_02",
  study: "rectangular_parquet",
  bedroom: "laminate_floor_02",
  hall: "floor_tiles_06",
  kitchen: "checkered_pavement_tiles",
  bathroom: "long_white_tiles",
  garage: "garage_floor",
  path: "rectangular_paving",
  grass: "leafy_grass",
  plaster: "plastered_wall_04",
  oak: "oak_wood_planks",
  marble: "marble_01",
  planks: "raw_plank_wall",
};

/** The sky: lights the house and shows over the garden. */
export const HDRI = "kloofendal_48d_partly_cloudy_puresky";

/**
 * Models, by the key the web app uses → the Poly Haven model, and when it differs from the
 * defaults, how big its textures get (px) and how many triangles it may keep (tris).
 */
export const MODELS: Record<string, { id: string; px?: number; tris?: number }> = {
  sofa: { id: "Sofa_01" },
  armchair: { id: "ArmChair_01" },
  coffeeTable: { id: "CoffeeTable_01" },
  cabinet: { id: "modern_wooden_cabinet" },
  tv: { id: "Television_01" },
  plant: { id: "potted_plant_02" },
  diningTable: { id: "dining_table" },
  desk: { id: "painted_wooden_table" },
  chair: { id: "dining_chair_02" },
  stool: { id: "bar_chair_round_01" },
  nightstand: { id: "ClassicNightstand_01" },
  bathCabinet: { id: "painted_wooden_nightstand" },
  vase: { id: "ceramic_vase_03" },
  basket: { id: "wicker_basket_02" },
  car: { id: "covered_car" },
  workbench: { id: "WoodenTable_03" },
  box: { id: "cardboard_box_01" },
  // Hideable props: a disguise is drawn with the very same model.
  duck: { id: "rubber_duck_toy" },
  apple: { id: "food_apple_01" },
  lemon: { id: "lemon" },
  football: { id: "football" },
  succulent: { id: "potted_plant_04" },
  wateringCan: { id: "watering_can_metal_01" },
  stone: { id: "stone_01" },
  rock: { id: "rock_09" },
  tin: { id: "cleaner_tin_01" },
  bucket: { id: "wooden_bucket_01" },
  gnome: { id: "garden_gnome" },
  can: { id: "can_rusted" },
  bleach: { id: "bleach_bottle" },
  cleaner: { id: "all_purpose_cleaner" },
  jug: { id: "jug_01" },
  gamepad: { id: "gamepad" },
  // Garden. Grass is drawn hundreds of times, so each clump is kept tiny.
  tree: { id: "tree_small_02", tris: 8000 },
  planter: { id: "planter_box_02" },
  flowers: { id: "periwinkle_plant", tris: 3000 },
  bench: { id: "painted_wooden_bench" },
  bush: { id: "shrub_02", tris: 4000 },
  grass: { id: "grass_medium_02", tris: 600, px: 256 },
};

const kb = (path: string) => `${Math.round(statSync(path).size / 1024)} KB`;

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

async function download(url: string, to: string) {
  if (existsSync(to)) return false;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
  return true;
}

type Files = Record<string, Record<string, Record<string, { url: string }>>>;

/**
 * diff (colour), nor (OpenGL normals) and arm (AO, roughness, metalness), as WebP: the colour
 * at 1024 px, the rest at 512 (bumps and shine don't need the detail).
 */
async function texture(key: string, id: string) {
  const files = await json<Files>(`/files/${id}`);
  const maps: [string, string, number][] = [
    ["diff", "Diffuse", 1024],
    ["nor", "nor_gl", 512],
    ["arm", files.arm ? "arm" : "Rough", 512],
  ];
  for (const [name, map, px] of maps) {
    const url = files[map]?.["1k"]?.jpg?.url;
    if (!url) throw new Error(`${id} has no 1k ${map}`);
    const raw = join(RAW, "textures", id, `${name}.jpg`);
    await download(url, raw);
    const to = join(OUT, "textures", key, `${name}.webp`);
    mkdirSync(dirname(to), { recursive: true });
    await sharp(raw).resize(px, px).webp({ quality: name === "diff" ? 78 : 82 }).toFile(to);
    // The JPEG the app used before.
    rmSync(join(OUT, "textures", key, `${name}.jpg`), { force: true });
  }
  console.log(`  ${key.padEnd(10)} ${id.padEnd(28)} ${maps.map(([n]) => kb(join(OUT, "textures", key, `${n}.webp`))).join(" / ")}${files.arm ? "" : "  (roughness only)"}`);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

interface GltfFiles {
  gltf: Record<string, { gltf: { url: string; include: Record<string, { url: string }> } }>;
}

/**
 * Points all over the scene's surfaces, in world space (after it's been stood on its base): every
 * vertex, plus points spread across every triangle, so a big flat table top with only four
 * corners still counts all the way across.
 */
function surfacePoints(doc: Document, spacing: number): number[][] {
  const out: number[][] = [];
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = node.getWorldMatrix();
    const world = (v: number[]) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const verts: number[][] = [];
      const v: number[] = [];
      for (let i = 0; i < pos.getCount(); i++) verts.push(world(pos.getElement(i, v).slice()));
      for (const v of verts) out.push(v);
      const index = prim.getIndices()?.getArray() ?? Array.from({ length: verts.length }, (_, i) => i);
      for (let t = 0; t + 2 < index.length; t += 3) {
        const [a, b, c] = [verts[index[t]], verts[index[t + 1]], verts[index[t + 2]]];
        const edge = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]), Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
        const n = Math.min(24, Math.ceil(edge / spacing));
        if (n < 2) continue;
        for (let i = 0; i <= n; i++) {
          for (let j = 0; j <= n - i; j++) {
            const u = i / n;
            const w = j / n;
            const k = 1 - u - w;
            out.push([a[0] * k + b[0] * u + c[0] * w, a[1] * k + b[1] * u + c[1] * w, a[2] * k + b[2] * u + c[2] * w]);
          }
        }
      }
    }
  });
  return out;
}

/**
 * The model's solid shape as a few boxes, each [x0, x1, z0, z1, y0, y1] as fractions of its
 * size: the footprint is cut into a grid of columns, each column is solid from the
 * lowest point anything reaches in it to the highest (so the space under a table top stays open,
 * and a seat is solid down to the floor only where it really is), and neighbouring columns of
 * about the same span are merged.
 */
function solidShape(points: number[][], min: number[], max: number[], GRID: number): number[][] {
  const size = [max[0] - min[0] || 1, max[1] - min[1] || 1, max[2] - min[2] || 1];
  const lo = Array.from({ length: GRID * GRID }, () => Infinity);
  const hi = Array.from({ length: GRID * GRID }, () => -Infinity);
  for (const [x, y, z] of points) {
    const i = Math.min(GRID - 1, Math.max(0, Math.floor(((x - min[0]) / size[0]) * GRID)));
    const k = Math.min(GRID - 1, Math.max(0, Math.floor(((z - min[2]) / size[2]) * GRID)));
    const fy = (y - min[1]) / size[1];
    const c = k * GRID + i;
    lo[c] = Math.min(lo[c], fy);
    hi[c] = Math.max(hi[c], fy);
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  const boxes: number[][] = [];
  for (let k = 0; k < GRID; k++) {
    let run: number[] | null = null;
    for (let i = 0; i < GRID; i++) {
      const c = k * GRID + i;
      // A bottom within a few percent of the floor is the floor: solid to it.
      const span = hi[c] < lo[c] ? null : [lo[c] < 0.04 ? 0 : round(lo[c]), round(hi[c])];
      if (run && span && Math.abs(run[4] - span[0]) < 0.05 && Math.abs(run[5] - span[1]) < 0.05) {
        run[1] = (i + 1) / GRID;
        run[4] = Math.min(run[4], span[0]);
        run[5] = Math.max(run[5], span[1]);
        continue;
      }
      if (run) boxes.push(run);
      run = span ? [i / GRID, (i + 1) / GRID, k / GRID, (k + 1) / GRID, span[0], span[1]] : null;
    }
    if (run) boxes.push(run);
  }
  return boxes;
}

/** Things smaller than this (metres, across) are small: fewer triangles and smaller textures. */
const SMALL_SIZE = 0.6;
const BUDGET = { small: 1500, large: 4000 };
const PIXELS = { small: 256, large: 512 };

const triangles = (doc: Document) =>
  doc
    .getRoot()
    .listMeshes()
    .reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")?.getCount() ?? 0) / 3, 0), 0);

async function model(key: string, id: string, px?: number, tris?: number): Promise<{ size: [number, number, number]; solid: number[][] }> {
  const dir = join(RAW, id);
  const files = await json<GltfFiles>(`/files/${id}`);
  const g = files.gltf["1k"].gltf;
  const main = join(dir, `${id}.gltf`);
  await download(g.url, main);
  for (const [path, file] of Object.entries(g.include)) {
    const to = join(dir, path);
    await download(file.url, to);
  }

  const doc = await io.read(main);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  await doc.transform(dedup(), prune(), weld(), center({ pivot: "below" }));
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const small = Math.max(size[0], size[2]) < SMALL_SIZE;
  // Down to its triangle budget, letting the shape drift a little (it's seen small, and moving).
  const before = triangles(doc);
  const budget = tris ?? (small ? BUDGET.small : BUDGET.large);
  // Some meshes resist (lots of seams): allow more drift until it fits, or nearly.
  await MeshoptSimplifier.ready;
  for (const error of [0.05, 0.15, 0.4]) {
    const now = triangles(doc);
    if (now <= budget * 1.2) break;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: budget / now, error }), prune());
  }
  const pixels = px ?? (small ? PIXELS.small : PIXELS.large);
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [pixels, pixels], quality: 80 }));
  const points = surfacePoints(doc, Math.min(size[0], size[2]) / (GRID * 2));
  const solid = solidShape(points, min, max, Math.max(size[0], size[2]) < SMALL ? SMALL_GRID : GRID);

  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize());
  const to = join(OUT, "models", `${key}.glb`);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, await io.writeBinary(doc));
  console.log(`  ${key.padEnd(12)} ${id.padEnd(24)} ${kb(to).padStart(7)}  ${Math.round(before)} → ${Math.round(triangles(doc))} triangles, ${pixels} px, ${solid.length} collider boxes`);
  return { size, solid };
}

async function main() {
  console.log("Textures (diff / nor / arm):");
  for (const [key, id] of Object.entries(TEXTURES)) await texture(key, id);

  const sky = join(OUT, "hdri/sky.hdr");
  const files = await json<{ hdri: Files[string] }>(`/files/${HDRI}`);
  await download(files.hdri["1k"].hdr.url, sky);
  console.log(`Sky: ${HDRI} ${kb(sky)}`);

  console.log("Models:");
  const sizes: Record<string, { size: [number, number, number]; solid: number[][] }> = {};
  for (const [key, { id, px, tris }] of Object.entries(MODELS)) sizes[key] = await model(key, id, px, tris);
  mkdirSync(dirname(SIZES), { recursive: true });
  writeFileSync(SIZES, `${JSON.stringify(sizes, null, 2)}\n`);
  // Models no longer listed are removed from the app.
  for (const f of readdirSync(join(OUT, "models"))) if (!(f.replace(/\.glb$/, "") in MODELS)) execFileSync("rm", [join(OUT, "models", f)]);
}

await main();
