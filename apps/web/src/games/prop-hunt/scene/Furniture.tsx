// Furniture drawn with Poly Haven models (art/models.ts), stretched into the box its colliders
// fill. Every copy of a model is one instanced mesh per piece of it, so twenty chairs cost what
// one does. Things to hide as aren't drawn here: see PropArt.
import { useMemo } from "react";
import type { HouseMap, MapProp, PropKind } from "@shadow/shared";
import { KIND_MODELS, type ModelKey } from "../art/models";
import { ModelBatches } from "./PropArt";

export function Furniture({ map, below = Infinity }: { map: HouseMap; below?: number }) {
  const byModel = useMemo(() => {
    const out = new Map<ModelKey, { kind: PropKind; prop: MapProp; part?: number }[]>();
    for (const prop of map.props) {
      const kind = map.kinds[prop.kind];
      const list = KIND_MODELS[prop.kind];
      if (!list || kind.disguise || prop.y >= below) continue;
      for (const m of list) {
        if (!out.has(m.model)) out.set(m.model, []);
        out.get(m.model)!.push({ kind, prop, part: m.part });
      }
    }
    return [...out.entries()];
  }, [map, below]);
  return (
    <>
      {byModel.map(([model, placed]) => (
        <ModelBatches key={model} model={model} placed={placed} />
      ))}
    </>
  );
}
