// The house: the textured shell (walls, floors, stairs: Shell.tsx), and every piece of furniture
// and prop as a handful of instanced meshes (one per shape), so the ~900 pieces cost a dozen
// draw calls. Disguisable props get meshes of their own, so aiming can tell which prop is under
// the crosshair.
import { Suspense, useLayoutEffect, useMemo, useRef, type Ref } from "react";
import { Preload } from "@react-three/drei";
import { Color, Group, Matrix4, Quaternion, Vector3, type InstancedMesh } from "three";
import type { Block, HouseMap, PartShape, PropKind, PropPart } from "@shadow/shared";
import { GEOMETRY, houseInstances, MATERIAL, noRaycast, SHAPES, seeded, type Instance } from "./shapes";
import { modelDraws } from "../art/models";
import { Furniture } from "./Furniture";
import { GrassClumps, TreeLine } from "./Garden";
import { PropArt } from "./PropArt";
import { Shell, shellDraws, shellDrawsPart } from "./Shell";

const tint = new Color();

function Instances({ shape, items, cast = true, pick = true }: { shape: PartShape; items: Instance[]; cast?: boolean; pick?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.matrix);
      mesh.setColorAt(i, tint.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [items]);
  if (items.length === 0) return null;
  // Keyed by length: an instanced mesh can't grow, so a new count means a new mesh.
  return <instancedMesh key={items.length} ref={ref} args={[GEOMETRY[shape], MATERIAL, items.length]} castShadow={cast} receiveShadow raycast={pick ? undefined : noRaycast} />;
}

/** Long grass as thin cones, while the real grass (Garden.tsx) loads. Never collides. */
function Grass({ map }: { map: HouseMap }) {
  const items = useMemo(() => {
    const rand = seeded(7);
    const out: Instance[] = [];
    const greens = ["#5d8a40", "#6f9a4a", "#4f7a36", "#7aa556"];
    const m = new Matrix4();
    const q = new Quaternion();
    for (const g of map.grass) {
      const n = Math.round((g.x1 - g.x0) * (g.z1 - g.z0) * 4);
      for (let i = 0; i < n; i++) {
        const h = 1.1 + rand() * 1;
        m.compose(new Vector3(g.x0 + rand() * (g.x1 - g.x0), 0, g.z0 + rand() * (g.z1 - g.z0)), q, new Vector3(0.22, h, 0.22));
        out.push({ matrix: m.clone(), color: greens[Math.floor(rand() * greens.length)] });
      }
    }
    return out;
  }, [map]);
  return <Instances shape="cone" items={items} cast={false} pick={false} />;
}

/**
 * The disguisable props as greybox shapes, while their art loads (PropArt draws them after).
 * Each mesh's `userData.props[instanceId]` says which placed prop an instance belongs to, so the
 * aim knows what it's looking at either way.
 */
function DisguiseProps({ items }: { items: Record<PartShape, Instance[]> }) {
  return (
    <>
      {SHAPES.map((shape) => (
        <DisguiseShape key={shape} shape={shape} items={items[shape]} />
      ))}
    </>
  );
}

function DisguiseShape({ shape, items }: { shape: PartShape; items: Instance[] }) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    const mesh = ref.current?.children[0] as InstancedMesh | undefined;
    if (mesh) mesh.userData.props = items.map((it) => it.prop);
  }, [items]);
  return (
    <group ref={ref}>
      <Instances shape={shape} items={items} />
    </group>
  );
}

/** The whole map. `below` hides everything from that height up, to look into the ground floor. */
/** Drawn by the textured shell or a model, rather than as a greybox shape. */
const isArt = { block: shellDraws, part: (kind: PropKind, i: number, part: PropPart) => shellDrawsPart(kind, i, part) || modelDraws(kind, i) };
const notArt = { block: (b: Block) => !isArt.block(b), part: (kind: PropKind, i: number, part: PropPart) => !isArt.part(kind, i, part) };

/** The whole map. `below` hides everything from that height up, to look into the ground floor. */
export function House({ map, below = Infinity, groupRef }: { map: HouseMap; below?: number; groupRef?: Ref<Group> }) {
  // The art (textured walls, floors and furniture, and models) loads; the rest stays greybox.
  const inst = useMemo(() => houseInstances(map, below, notArt), [map, below]);
  // Until the art has loaded, it shows as greybox shapes too.
  const plain = useMemo(() => {
    const all = houseInstances(map, below, isArt);
    return { solid: all.solid, flat: all.flat };
  }, [map, below]);
  return (
    <group ref={groupRef}>
      <Suspense
        fallback={
          <>
            {SHAPES.map((shape) => (
              <Instances key={shape} shape={shape} items={plain.solid[shape]} />
            ))}
            <Instances shape="box" items={plain.flat} cast={false} />
            <DisguiseProps items={inst.disguise} />
            <Grass map={map} />
          </>
        }
      >
        <Shell map={map} below={below} />
        <Furniture map={map} below={below} />
        <PropArt map={map} below={below} />
        <GrassClumps map={map} />
        <TreeLine map={map} />
        {/* Once it's all loaded: compile every shader and upload every texture now, so nothing
            stalls a frame the first time it comes into view (walking in, or a respawn). */}
        <Preload all />
      </Suspense>
      {SHAPES.map((shape) => (
        <Instances key={shape} shape={shape} items={inst.solid[shape]} />
      ))}
      <Instances shape="box" items={inst.flat} cast={false} />
    </group>
  );
}
