// The house's colliders, as drawn: walls and floors as they are, pieces built from parts as
// their parts, and anything drawn with a model as that model's solid shape (measured by the
// asset pipeline), fitted and turned exactly like the model. So a carved table skirt or a chair
// back stops you, and the open space under a table top doesn't.
import { mapColliders, partBox, turnXZ, type Collider, type HouseMap } from "@shadow/shared";
import { KIND_MODELS, kindBox, modelDraws, modelSolid } from "./models";

export function artColliders(map: HouseMap): Collider[] {
  // Walls, floors and stairs: the map's own blocks.
  const out: Collider[] = mapColliders({ ...map, props: [] });
  for (const p of map.props) {
    const kind = map.kinds[p.kind];
    kind.parts.forEach((part, i) => {
      if (!part.pass && !modelDraws(kind, i)) out.push({ ...partBox(part, p), step: false });
    });
    // Pieces you walk through (flowers) don't collide, model or not.
    if (kind.parts.every((part) => part.pass)) continue;
    for (const m of KIND_MODELS[kind.id] ?? []) {
      // The box the model fills, unturned and around the piece's origin.
      const fit = m.part === undefined ? kindBox(kind) : partBox(kind.parts[m.part], { x: 0, y: 0, z: 0, turn: 0 });
      const w = fit.x1 - fit.x0;
      const h = fit.y1 - fit.y0;
      const d = fit.z1 - fit.z0;
      for (const [fx0, fx1, fz0, fz1, fy0, fy1] of modelSolid(m.model)) {
        // A box in the piece, then turned (quarter turns keep boxes boxes) and placed.
        const [ax, az] = turnXZ(fit.x0 + fx0 * w, fit.z0 + fz0 * d, p.turn);
        const [bx, bz] = turnXZ(fit.x0 + fx1 * w, fit.z0 + fz1 * d, p.turn);
        out.push({
          x0: p.x + Math.min(ax, bx),
          x1: p.x + Math.max(ax, bx),
          z0: p.z + Math.min(az, bz),
          z1: p.z + Math.max(az, bz),
          y0: p.y + fit.y0 + fy0 * h,
          y1: p.y + fit.y0 + fy1 * h,
          step: false,
        });
      }
    }
  }
  return out;
}
