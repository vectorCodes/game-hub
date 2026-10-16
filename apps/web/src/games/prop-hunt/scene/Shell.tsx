// The house itself, with real materials: wood, tile and plaster from Poly Haven (CC0, fetched by
// tools/models/src/propHunt.ts), and plain ones (paint, porcelain, enamel, metal, fabric) for
// furniture built from parts. Everything made of one surface is merged into one mesh, and
// textures are laid on in world space, so a floor runs on seamlessly from one block to the next
// and a plank is the same size everywhere.
import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { BoxGeometry, Color, Float32BufferAttribute, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type BufferGeometry, type Texture } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Block, HouseMap, PropKind, PropPart } from "@shadow/shared";
import { PLAIN } from "../art/materials";
import { modelDraws } from "../art/models";
import { GEOMETRY, partMatrix } from "./shapes";

interface Surface {
  /** Textured: world units one copy of the texture covers (1 unit ≈ 17 cm, so 12 is about 2 m). */
  tile?: number;
  /** Textured: multiplies the texture. */
  tint?: string;
  roughness?: number;
  metalness?: number;
}

/** Textured surfaces (Poly Haven) and plain ones (no texture; the part's own colour). */
export const SURFACES: Record<string, Surface> = {
  living: { tile: 9 },
  kids: { tile: 10 },
  study: { tile: 9 },
  bedroom: { tile: 10 },
  hall: { tile: 10 },
  kitchen: { tile: 12 },
  bathroom: { tile: 8 },
  garage: { tile: 14 },
  path: { tile: 12 },
  grass: { tile: 14, tint: "#cfe0b8" },
  plaster: { tile: 12, tint: "#f6efe4" },
  oak: { tile: 10 },
  marble: { tile: 10 },
  planks: { tile: 10, tint: "#d8c3a5" },
  ...PLAIN,
};

const TEXTURED = Object.keys(SURFACES).filter((k) => SURFACES[k].tile !== undefined);
const url = (key: string, map: string) => `/prop-hunt/textures/${key}/${map}.webp`;

/** Every textured surface's three maps, for preloading and for useTexture. */
export const SURFACE_URLS = TEXTURED.flatMap((key) => ["diff", "nor", "arm"].map((m) => url(key, m)));

/** One material per surface: PBR maps for the textured ones, vertex colours for the plain ones. */
function useSurfaceMaterials(): Record<string, MeshStandardMaterial> {
  const textures = useTexture(SURFACE_URLS) as Texture[];
  const materials = useMemo(() => {
    const out: Record<string, MeshStandardMaterial> = {};
    for (const [key, s] of Object.entries(SURFACES)) {
      const i = TEXTURED.indexOf(key);
      if (i < 0) {
        out[key] = new MeshStandardMaterial({ vertexColors: true, roughness: s.roughness ?? 0.8, metalness: s.metalness ?? 0 });
        continue;
      }
      const [diff, nor, arm] = textures.slice(i * 3, i * 3 + 3);
      for (const t of [diff, nor, arm]) {
        t.wrapS = t.wrapT = RepeatWrapping;
        t.anisotropy = 8;
        t.needsUpdate = true;
      }
      diff.colorSpace = SRGBColorSpace;
      out[key] = new MeshStandardMaterial({
        map: diff,
        normalMap: nor,
        aoMap: arm,
        roughnessMap: arm,
        metalnessMap: arm,
        metalness: 1,
        roughness: s.roughness ?? 1,
        aoMapIntensity: 0.8,
        color: new Color(s.tint ?? "#ffffff"),
      });
    }
    return out;
  }, [textures]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  return materials;
}

/**
 * UVs from world position: each face takes the two world axes it lies along, divided by the
 * tile size, so neighbouring pieces line up. Also a colour per vertex (for plain surfaces).
 */
function finish(g: BufferGeometry, tile: number, color: Color): BufferGeometry {
  const pos = g.attributes.position;
  const normal = g.attributes.normal;
  const uv = g.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ny > 0.5) uv.setXY(i, x / tile, z / tile);
    else if (nx > 0.5) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return g;
}

const WHITE = new Color("#ffffff");
const tint = new Color();

/** Blocks the shell draws (the rest stay greybox boxes): visible, and made of a known surface. */
export const shellDraws = (b: Block) => b.color !== null && b.surface !== undefined && b.surface in SURFACES;

/** Furniture parts the shell draws: made of a known surface, and not covered by a model. (Things to hide as have their own renderer: PropArt.) */
export const shellDrawsPart = (kind: PropKind, i: number, part: PropPart) =>
  !kind.disguise && part.surface !== undefined && part.surface in SURFACES && !modelDraws(kind, i);

type Piece = { surface: string; shadow: boolean; geometry: BufferGeometry };

/** Merges pieces per surface (and per shadow casting) into one mesh each. */
function useMerged(pieces: Piece[]) {
  const meshes = useMemo(() => {
    const groups = new Map<string, Piece[]>();
    for (const p of pieces) {
      const key = `${p.surface}:${p.shadow}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    return [...groups.entries()].map(([key, list]) => {
      const geometry = mergeGeometries(list.map((p) => p.geometry));
      for (const p of list) p.geometry.dispose();
      return { key, geometry, surface: list[0].surface, shadow: list[0].shadow };
    });
  }, [pieces]);
  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);
  return meshes;
}

function Merged({ pieces }: { pieces: Piece[] }) {
  const materials = useSurfaceMaterials();
  const meshes = useMerged(pieces);
  return (
    <>
      {meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry} material={materials[m.surface]} castShadow={m.shadow} receiveShadow />
      ))}
    </>
  );
}

/** The house's walls, floors, stairs, fence and shed, and the furniture built from parts. */
export function Shell({ map, below = Infinity }: { map: HouseMap; below?: number }) {
  const pieces = useMemo(() => {
    const out: Piece[] = [];
    for (const b of map.blocks) {
      if (!shellDraws(b) || b.y0 >= below) continue;
      const s = SURFACES[b.surface!];
      const g = new BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0).translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      out.push({ surface: b.surface!, shadow: b.shadow, geometry: finish(g, s.tile ?? 1, WHITE) });
    }
    for (const p of map.props) {
      if (p.y >= below) continue;
      const kind = map.kinds[p.kind];
      kind.parts.forEach((part, i) => {
        if (!shellDrawsPart(kind, i, part)) return;
        const s = SURFACES[part.surface!];
        const g = GEOMETRY[part.shape].clone().applyMatrix4(partMatrix(part, p));
        out.push({ surface: part.surface!, shadow: true, geometry: finish(g, s.tile ?? 1, s.tile ? WHITE : tint.set(part.color)) });
      });
    }
    return out;
  }, [map, below]);
  return <Merged pieces={pieces} />;
}
