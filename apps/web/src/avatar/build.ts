// Assembles a GameHub avatar from Kenney's Mini Characters: one character's body (outfit)
// with another's head (hair & face), recoloured, with a hat and eyewear on the head bone.
//
// Every character's colours come from one palette texture of 32×128 px swatches. A part is
// recoloured by moving its UVs into another swatch, keeping each vertex's offset inside the
// swatch so the built-in shading survives. Which vertices are skin, hair or clothes is
// worked out from the mesh itself (see analyzeHead / analyzeBody).
import {
  BufferAttribute,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SphereGeometry,
  BoxGeometry,
  TorusGeometry,
  type AnimationClip,
  type BufferGeometry,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES, type AvatarConfig, type AvatarStyle, type Swatch } from "@shadow/shared";

export const characterUrl = (style: AvatarStyle) => `/sky-climb/characters/character-${style}.glb`;
export const GLASSES_URL = "/sky-climb/characters/glasses.glb";
export const SUNGLASSES_URL = "/sky-climb/characters/sunglasses.glb";

export interface Loaded {
  scene: Object3D;
  animations: AnimationClip[];
}

const COLS = 16;
const ROWS = 4;
const cellOf = (u: number, v: number): [number, number] => [Math.floor(u * COLS), Math.floor(v * ROWS)];
const cellKey = (c: [number, number]) => c[0] * 10 + c[1];

/** Vertex indices of each recolourable region of a part. */
interface Regions {
  [region: string]: number[];
}

/** Groups vertices into connected pieces (shared indices, or shared positions across seams). */
function pieces(g: BufferGeometry): number[][] {
  const pos = g.getAttribute("position");
  const n = pos.count;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[a] = b;
  };
  const index = g.getIndex();
  if (index) {
    for (let t = 0; t < index.count; t += 3) {
      join(index.getX(t), index.getX(t + 1));
      join(index.getX(t + 1), index.getX(t + 2));
    }
  }
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const j = seen.get(k);
    if (j === undefined) seen.set(k, i);
    else join(i, j);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  return [...groups.values()];
}

interface Piece {
  vertices: number[];
  cells: Map<number, number>;
  dominant: number;
  min: [number, number, number];
  max: [number, number, number];
}

function describe(g: BufferGeometry): Piece[] {
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  return pieces(g).map((vertices) => {
    const cells = new Map<number, number>();
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const i of vertices) {
      const k = cellKey(cellOf(uv.getX(i), uv.getY(i)));
      cells.set(k, (cells.get(k) ?? 0) + 1);
      const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], p[c]);
        max[c] = Math.max(max[c], p[c]);
      }
    }
    const dominant = [...cells].sort((a, b) => b[1] - a[1])[0][0];
    return { vertices, cells, dominant, min, max };
  });
}

const cellAt = (g: BufferGeometry, i: number) => {
  const uv = g.getAttribute("uv");
  return cellKey(cellOf(uv.getX(i), uv.getY(i)));
};

/** Mouths and eyes: tiny pieces left exactly as they are. */
const isFeature = (p: Piece) => p.vertices.length <= 12;

interface HeadAnalysis {
  regions: Regions;
  skinCell: number;
}

const headCache = new WeakMap<BufferGeometry, HeadAnalysis>();

/**
 * Head: the face is the 0.32-unit cube; its swatch is the skin (face and ears). The hair is
 * the swatch of the biggest other piece, wherever it appears (eyebrows and beards included).
 * Glasses, headbands and the like have their own swatches and keep them.
 */
export function analyzeHead(g: BufferGeometry): HeadAnalysis {
  const cached = headCache.get(g);
  if (cached) return cached;
  const parts = describe(g);
  const size = (p: Piece, c: number) => p.max[c] - p.min[c];
  const face =
    parts.find((p) => [0, 1, 2].every((c) => Math.abs(size(p, c) - 0.32) < 0.03)) ??
    [...parts].sort((a, b) => b.vertices.length - a.vertices.length)[0];
  const skinCell = face.dominant;
  const others = parts.filter((p) => !isFeature(p) && p.dominant !== skinCell).sort((a, b) => b.vertices.length - a.vertices.length);
  const hairCell = others[0]?.dominant;
  const skin: number[] = [];
  const hair: number[] = [];
  for (const p of parts) {
    if (isFeature(p)) continue;
    for (const i of p.vertices) {
      const c = cellAt(g, i);
      if (c === skinCell) skin.push(i);
      else if (c === hairCell) hair.push(i);
    }
  }
  const result = { regions: { skin, hair }, skinCell };
  headCache.set(g, result);
  return result;
}

const bodyCache = new WeakMap<BufferGeometry, Regions>();

/**
 * Body: skin is the character's own skin swatch (hands, bare legs). Clothes split by height
 * into shoes, bottoms and top; in each, the most-used swatch is the one that's recoloured,
 * so soles, belts and buttons keep their colours.
 */
export function analyzeBody(g: BufferGeometry, skinCell: number): Regions {
  const cached = bodyCache.get(g);
  if (cached) return cached;
  const parts = describe(g);
  const slots: Record<"top" | "bottom" | "shoes", number[]> = { top: [], bottom: [], shoes: [] };
  const skin: number[] = [];
  for (const p of parts) {
    const slot = p.max[1] <= 0.1 ? "shoes" : p.min[1] >= 0.17 ? "top" : "bottom";
    for (const i of p.vertices) {
      if (cellAt(g, i) === skinCell) skin.push(i);
      else slots[slot].push(i);
    }
  }
  const regions: Regions = { skin };
  for (const [slot, vertices] of Object.entries(slots)) {
    const counts = new Map<number, number>();
    for (const i of vertices) counts.set(cellAt(g, i), (counts.get(cellAt(g, i)) ?? 0) + 1);
    const main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    regions[slot] = vertices.filter((i) => cellAt(g, i) === main);
  }
  bodyCache.set(g, regions);
  return regions;
}

/** A copy of the geometry with each region's UVs moved into its new swatch. */
function recolor(g: BufferGeometry, regions: Regions, colors: Record<string, Swatch | undefined>): BufferGeometry {
  const out = g.clone();
  const uv = out.getAttribute("uv") as BufferAttribute;
  for (const [region, vertices] of Object.entries(regions)) {
    const target = colors[region];
    if (!target) continue;
    const [tc, tr] = target.cell;
    for (const i of vertices) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      const [c, r] = cellOf(u, v);
      uv.setXY(i, (tc + (u * COLS - c)) / COLS, (tr + (v * ROWS - r)) / ROWS);
    }
  }
  uv.needsUpdate = true;
  return out;
}

const find = <T,>(list: T[], id: string) => (list as (T & { id: string })[]).find((s) => s.id === id);

function meshNamed(root: Object3D, name: string) {
  let found: SkinnedMesh | undefined;
  root.traverse((o) => {
    if (o.name === name && (o as SkinnedMesh).isSkinnedMesh) found = o as SkinnedMesh;
  });
  return found;
}

// ---------- Hats and eyewear: small low-poly pieces in the head bone's frame ----------

/** Top of the head, front of the face, and eye height, in the head bone's frame. */
const HEAD_TOP = 0.31;
const FACE_FRONT = 0.165;
const EYES = 0.09;

const materials = new Map<string, MeshStandardMaterial>();
function mat(color: string, metal = false) {
  let m = materials.get(color + metal);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: metal ? 0.35 : 0.75, metalness: metal ? 0.6 : 0, flatShading: true });
    materials.set(color + metal, m);
  }
  return m;
}

function part(geometry: BufferGeometry, material: MeshStandardMaterial, x = 0, y = 0, z = 0, name = "") {
  const m = new Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.name = name;
  return m;
}

function makeHat(id: string): Object3D | null {
  const g = new Group();
  const y = HEAD_TOP;
  switch (id) {
    case "hat:cap":
      g.add(part(new SphereGeometry(0.19, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat("#e65f48"), 0, y - 0.04, 0));
      g.add(part(new BoxGeometry(0.3, 0.025, 0.16), mat("#e65f48"), 0, y - 0.03, 0.18));
      g.add(part(new SphereGeometry(0.025, 6, 4), mat("#ffffff"), 0, y + 0.15, 0));
      break;
    case "hat:beanie":
      g.add(part(new SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat("#6794d9"), 0, y - 0.05, 0));
      g.add(part(new CylinderGeometry(0.205, 0.205, 0.07, 8), mat("#d0e8ff"), 0, y - 0.04, 0));
      g.add(part(new SphereGeometry(0.06, 6, 4), mat("#ffffff"), 0, y + 0.17, 0));
      break;
    case "hat:party":
      g.add(part(new ConeGeometry(0.12, 0.3, 8), mat("#f378f0"), 0, y + 0.13, 0));
      g.add(part(new TorusGeometry(0.1, 0.02, 4, 8).rotateX(Math.PI / 2), mat("#ffc044"), 0, y + 0.03, 0));
      g.add(part(new SphereGeometry(0.045, 6, 4), mat("#ffc044"), 0, y + 0.29, 0));
      break;
    case "hat:cowboy":
      g.add(part(new CylinderGeometry(0.34, 0.34, 0.025, 10), mat("#a25c41"), 0, y, 0));
      g.add(part(new CylinderGeometry(0.15, 0.18, 0.16, 8), mat("#a25c41"), 0, y + 0.09, 0));
      g.add(part(new CylinderGeometry(0.182, 0.182, 0.035, 8), mat("#41414a"), 0, y + 0.03, 0));
      break;
    case "hat:tophat":
      g.add(part(new CylinderGeometry(0.27, 0.27, 0.025, 10), mat("#38383d"), 0, y, 0));
      g.add(part(new CylinderGeometry(0.16, 0.16, 0.3, 10), mat("#38383d"), 0, y + 0.16, 0));
      g.add(part(new CylinderGeometry(0.163, 0.163, 0.05, 10), mat("#cf534f"), 0, y + 0.04, 0));
      break;
    case "hat:propeller": {
      g.add(part(new SphereGeometry(0.19, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat("#ffc044"), 0, y - 0.04, 0));
      g.add(part(new CylinderGeometry(0.012, 0.012, 0.12, 5), mat("#868ba1", true), 0, y + 0.2, 0));
      // Named "spin": the avatar turns it every frame.
      const blades = new Group();
      blades.name = "spin";
      blades.position.set(0, y + 0.26, 0);
      blades.add(part(new BoxGeometry(0.34, 0.012, 0.06), mat("#e65f48")));
      blades.add(part(new BoxGeometry(0.06, 0.012, 0.34), mat("#6794d9")));
      g.add(blades);
      break;
    }
    case "hat:crown": {
      g.add(part(new CylinderGeometry(0.18, 0.17, 0.1, 10, 1, true), mat("#f8cf72", true), 0, y + 0.03, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(part(new ConeGeometry(0.04, 0.09, 4), mat("#f8cf72", true), Math.sin(a) * 0.16, y + 0.12, Math.cos(a) * 0.16));
      }
      g.add(part(new SphereGeometry(0.03, 6, 4), mat("#cf534f"), 0, y + 0.04, 0.18));
      break;
    }
    case "hat:wizard":
      g.add(part(new CylinderGeometry(0.3, 0.3, 0.02, 10), mat("#8f63d8"), 0, y, 0));
      g.add(part(new ConeGeometry(0.18, 0.46, 8), mat("#8f63d8"), 0, y + 0.24, 0));
      g.add(part(new ConeGeometry(0.035, 0.05, 4), mat("#ffc044"), 0.07, y + 0.15, 0.13));
      break;
    default:
      return null;
  }
  return g;
}

function makeEyewear(id: string, models: { glasses?: Object3D; sunglasses?: Object3D }): Object3D | null {
  if (id === "eyewear:glasses" || id === "eyewear:sunglasses") {
    const source = id === "eyewear:glasses" ? models.glasses : models.sunglasses;
    if (!source) return null;
    const m = source.clone(true);
    m.position.set(0, EYES - 0.005, FACE_FRONT - 0.09);
    return m;
  }
  if (id === "eyewear:goggles") {
    const g = new Group();
    g.add(part(new BoxGeometry(0.36, 0.05, 0.34), mat("#41414a"), 0, EYES + 0.04, 0));
    const lens = new MeshStandardMaterial({ color: "#ff9f5a", emissive: "#ff7e44", emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.3 });
    g.add(part(new BoxGeometry(0.28, 0.09, 0.04), lens, 0, EYES + 0.04, FACE_FRONT + 0.015));
    g.add(part(new BoxGeometry(0.3, 0.11, 0.03), mat("#ffffff"), 0, EYES + 0.04, FACE_FRONT));
    return g;
  }
  return null;
}

export interface BuiltAvatar {
  root: Object3D;
  animations: AnimationClip[];
}

/**
 * The avatar as a fresh, independent object: `body` provides the skeleton and animations,
 * `head` the head mesh, rebound to that skeleton with its own rest pose.
 */
export function buildAvatar(
  config: AvatarConfig,
  body: Loaded,
  head: Loaded,
  extras: { glasses?: Object3D; sunglasses?: Object3D } = {},
): BuiltAvatar {
  const root = cloneSkinned(body.scene);
  const bodyMesh = meshNamed(root, "body-mesh");
  const headMesh = meshNamed(root, "head-mesh");
  const headSource = meshNamed(head.scene, "head-mesh");
  const ownHead = meshNamed(body.scene, "head-mesh");
  if (!bodyMesh || !headMesh || !headSource || !ownHead) return { root, animations: body.animations };

  const skin = find(SKIN_TONES, config.skin);
  const hair = find(HAIR_COLORS, config.hair);
  const outfit = (id: string) => find(OUTFIT_COLORS, id);

  // The body's skin swatch is the one its own head's face uses.
  const bodySkinCell = analyzeHead(ownHead.geometry).skinCell;
  bodyMesh.geometry = recolor(bodyMesh.geometry, analyzeBody(bodyMesh.geometry, bodySkinCell), {
    skin,
    top: outfit(config.top),
    bottom: outfit(config.bottom),
    shoes: outfit(config.shoes),
  });

  headMesh.geometry = recolor(headSource.geometry, analyzeHead(headSource.geometry).regions, { skin, hair });
  if (config.head !== config.body) {
    headMesh.bind(new Skeleton(headMesh.skeleton.bones, headSource.skeleton.boneInverses.map((m) => m.clone())), headMesh.bindMatrix);
  }

  for (const mesh of [bodyMesh, headMesh]) {
    mesh.castShadow = true;
    // Skinned meshes animate outside their bind-pose bounds.
    mesh.frustumCulled = false;
  }

  const bone = root.getObjectByName("head");
  if (bone) {
    const hat = makeHat(config.hat);
    if (hat) bone.add(hat);
    const eyewear = makeEyewear(config.eyewear, extras);
    if (eyewear) bone.add(eyewear);
  }
  return { root, animations: body.animations };
}

/** Spins propellers and the like; call every frame. */
export function animateAccessories(root: Object3D, dt: number) {
  root.traverse((o) => {
    if (o.name === "spin") o.rotation.y += dt * 14;
  });
}
