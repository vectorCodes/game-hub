// The greybox's building blocks: one unit geometry per shape (origin at the bottom centre, so a
// part's matrix is just "stand here, this big"), and the instance lists the house draws.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Euler, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type BufferGeometry, type Object3D } from "three";
import { turnXZ, type Block, type HouseMap, type MapProp, type PartShape, type PropKind, type PropPart } from "@shadow/shared";

export const GEOMETRY: Record<PartShape, BufferGeometry> = {
  box: new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl: new CylinderGeometry(0.5, 0.5, 1, 24).translate(0, 0.5, 0),
  ball: new SphereGeometry(0.5, 24, 16).translate(0, 0.5, 0),
  cone: new ConeGeometry(0.5, 1, 24).translate(0, 0.5, 0),
};

export const SHAPES = Object.keys(GEOMETRY) as PartShape[];

/**
 * One material for everything: each instance brings its own colour. A disguised player is
 * drawn with the same settings in that colour, so it looks exactly like the real prop.
 */
export const MATERIAL = new MeshStandardMaterial({ roughness: 0.85, metalness: 0 });

/** For meshes the aim should see straight through (long grass). */
export const noRaycast: Object3D["raycast"] = () => {};

export interface Instance {
  matrix: Matrix4;
  color: string;
  /** For disguisable props: which placed prop this part belongs to. */
  prop?: number;
}

const pos = new Vector3();
const scale = new Vector3();
const quat = new Quaternion();
const euler = new Euler();

/** Where a prop's part stands in the world. */
export function partMatrix(part: PropPart, p: Pick<MapProp, "x" | "y" | "z" | "turn">): Matrix4 {
  const [ox, oy, oz] = part.at ?? [0, 0, 0];
  const [dx, dz] = turnXZ(ox, oz, p.turn);
  pos.set(p.x + dx, p.y + oy, p.z + dz);
  quat.setFromEuler(euler.set(0, (p.turn * Math.PI) / 2, 0));
  scale.set(...part.size);
  return new Matrix4().compose(pos, quat, scale);
}

export interface HouseInstances {
  /** Walls, floors and furniture, by shape; `flat` ones (floor slabs) cast no shadow. */
  solid: Record<PartShape, Instance[]>;
  flat: Instance[];
  /** Everything a hider can become, by shape. */
  disguise: Record<PartShape, Instance[]>;
}

const byShape = (): Record<PartShape, Instance[]> => ({ box: [], cyl: [], ball: [], cone: [] });

/** Which blocks and furniture parts an instance list keeps (everything, if not given). */
export interface Keep {
  block?: (b: Block) => boolean;
  part?: (kind: PropKind, i: number, part: PropPart) => boolean;
}

/**
 * Splits a map into instance lists. `below` hides everything from that height up (to look into
 * the ground floor); `keep` picks what this list draws (the rest is drawn some other way: the
 * textured shell, the furniture models). Disguisable props are always kept.
 */
export function houseInstances(map: HouseMap, below = Infinity, keep: Keep = {}): HouseInstances {
  const out: HouseInstances = { solid: byShape(), flat: [], disguise: byShape() };
  for (const b of map.blocks) {
    if (!b.color || b.y0 >= below || (keep.block && !keep.block(b))) continue;
    const matrix = new Matrix4().compose(pos.set((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2), quat.identity(), scale.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0));
    (b.shadow ? out.solid.box : out.flat).push({ matrix, color: b.color });
  }
  for (const p of map.props) {
    if (p.y >= below) continue;
    const kind = map.kinds[p.kind];
    kind.parts.forEach((part, i) => {
      if (!kind.disguise && keep.part && !keep.part(kind, i, part)) return;
      const instance: Instance = { matrix: partMatrix(part, p), color: part.color };
      if (kind.disguise) out.disguise[part.shape].push({ ...instance, prop: p.id });
      else out.solid[part.shape].push(instance);
    });
  }
  return out;
}

/** A small seeded random, so the grass grows the same way for everyone. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
