// The hole's collision meshes, built from the kit's own models (so the ball meets exactly
// what's drawn). Pure data: the browser passes triangles from the loaded models, and the
// server can pass the same from the GLB files.
import { FLOOR_Y } from "./config";
import type { HoleLayout } from "./course";
import type { CollisionMesh, CourseCollision } from "./physics";

/** A piece's triangles in its own space: xyz for each corner, three corners per triangle. */
export type PieceTriangles = Float32Array;

const EDGE = 0.5 - 1e-3;
const QUANT = 1e4;

class MeshBuilder {
  private readonly index = new Map<string, number>();
  private readonly vertices: number[] = [];
  private readonly indices: number[] = [];

  /** Shared corners are merged (the same point on two tiles is one vertex), so the ball rolls over seams. */
  private vertex(x: number, y: number, z: number): number {
    const qx = Math.round(x * QUANT);
    const qy = Math.round(y * QUANT);
    const qz = Math.round(z * QUANT);
    const key = `${qx},${qy},${qz}`;
    let i = this.index.get(key);
    if (i === undefined) {
      i = this.vertices.length / 3;
      this.vertices.push(qx / QUANT, qy / QUANT, qz / QUANT);
      this.index.set(key, i);
    }
    return i;
  }

  add(a: number[], b: number[], c: number[]) {
    const ia = this.vertex(a[0], a[1], a[2]);
    const ib = this.vertex(b[0], b[1], b[2]);
    const ic = this.vertex(c[0], c[1], c[2]);
    if (ia === ib || ib === ic || ia === ic) return;
    this.indices.push(ia, ib, ic);
  }

  build(): CollisionMesh {
    return { vertices: new Float32Array(this.vertices), indices: new Uint32Array(this.indices) };
  }
}

/**
 * Splits the course into green (faces that point up) and walls (everything else). Faces
 * the ball can never touch are dropped: undersides, and the sides of a tile's base where
 * it meets the next tile.
 */
export function courseCollision(hole: HoleLayout, pieces: Record<string, PieceTriangles>): CourseCollision {
  const floor = new MeshBuilder();
  const walls = new MeshBuilder();
  let floorY = Infinity;
  const corners = [new Array<number>(3), new Array<number>(3), new Array<number>(3)];
  const local = [new Array<number>(3), new Array<number>(3), new Array<number>(3)];

  for (const tile of hole.tiles) {
    const tris = pieces[tile.piece];
    if (!tris) throw new Error(`No collision triangles for ${tile.piece}`);
    floorY = Math.min(floorY, tile.y + FLOOR_Y);
    const a = (tile.rot * Math.PI) / 2;
    const cos = Math.round(Math.cos(a));
    const sin = Math.round(Math.sin(a));

    for (let t = 0; t < tris.length; t += 9) {
      for (let k = 0; k < 3; k++) {
        const x = tris[t + k * 3];
        const y = tris[t + k * 3 + 1];
        const z = tris[t + k * 3 + 2];
        local[k][0] = x;
        local[k][1] = y;
        local[k][2] = z;
        // Turn as three.js does (rotation.y), then move to the tile.
        corners[k][0] = x * cos + z * sin + tile.x;
        corners[k][1] = y + tile.y;
        corners[k][2] = -x * sin + z * cos + tile.z;
      }
      const [p, q, r] = corners;
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2];
      const vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-10) continue;
      const up = ny / len;
      if (up < -0.5) continue;
      const low = local.every((v) => v[1] <= FLOOR_Y + 1e-3);
      const onEdge = (axis: 0 | 2) => local.every((v) => v[axis] >= EDGE) || local.every((v) => v[axis] <= -EDGE);
      if (up < 0.5 && low && (onEdge(0) || onEdge(2))) continue;
      (up > 0.5 ? floor : walls).add(p, q, r);
    }
  }
  return { floor: floor.build(), walls: walls.build(), floorY };
}
