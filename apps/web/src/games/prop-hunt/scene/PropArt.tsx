// Everything a hider can become, drawn two ways that must look exactly alike:
// - PropArt: every real one in the house, instanced (one instanced mesh per shape and material
//   for things built from parts, one per piece of each model). Each mesh's
//   `userData.props[instanceId]` says which placed prop an instance is, for the aim.
// - PropModel: one on its own (a hider in disguise), from the very same geometry and the very
//   same material objects.
import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { BackSide, Euler, Matrix4, MeshBasicMaterial, Quaternion, Vector3, type BufferGeometry, type InstancedMesh, type Material, type Mesh } from "three";
import type { HouseMap, MapProp, PropKind } from "@shadow/shared";
import { AIM } from "../config";
import { partMaterial } from "../art/materials";
import { KIND_MODELS, modelFit, modelUrl, type ModelKey } from "../art/models";
import { GEOMETRY, partMatrix } from "./shapes";

/** The pieces of a model: each mesh's geometry and material, placed relative to the model's base. */
function useModelPieces(key: ModelKey): { geometry: BufferGeometry; material: Material; matrix: Matrix4 }[] {
  const { scene } = useGLTF(modelUrl(key));
  return useMemo(() => {
    const out: { geometry: BufferGeometry; material: Material; matrix: Matrix4 }[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) out.push({ geometry: mesh.geometry, material: mesh.material as Material, matrix: mesh.matrixWorld.clone() });
    });
    return out;
  }, [scene]);
}

const euler = new Euler();
const quat = new Quaternion();

/** Where a placed prop's model goes: the prop's place and turn, then the model's fit into its box (or one part's). */
function modelMatrix(kind: PropKind, model: ModelKey, p: Pick<MapProp, "x" | "y" | "z" | "turn">, part?: number): Matrix4 {
  const { at, scale } = modelFit(kind, { model, part });
  const place = new Matrix4().compose(new Vector3(p.x, p.y, p.z), quat.setFromEuler(euler.set(0, (p.turn * Math.PI) / 2, 0)), new Vector3(1, 1, 1));
  return place.multiply(new Matrix4().compose(new Vector3(...at), new Quaternion(), new Vector3(...scale)));
}

const modelOf = (kind: PropKind): ModelKey | null => KIND_MODELS[kind.id]?.[0]?.model ?? null;

// ---------- One on its own (a disguise) ----------

const OUTLINE = new MeshBasicMaterial({ color: AIM.outline, side: BackSide, transparent: true, opacity: 0.95, depthWrite: false });

function ModelProp({ kind, model, outline }: { kind: PropKind; model: ModelKey; outline: number }) {
  const pieces = useModelPieces(model);
  const fit = useMemo(() => {
    const m = modelMatrix(kind, model, { x: 0, y: 0, z: 0, turn: 0 });
    // An outline is the same model, a little bigger and inside out, grown about its middle.
    if (outline) {
      const h = kind.parts.reduce((y, p) => Math.max(y, (p.at?.[1] ?? 0) + p.size[1]), 0);
      const grow = 1 + outline * 2.5;
      m.premultiply(new Matrix4().makeTranslation(0, -h / 2, 0)).premultiply(new Matrix4().makeScale(grow, grow, grow)).premultiply(new Matrix4().makeTranslation(0, h / 2, 0));
    }
    return m;
  }, [kind, model, outline]);
  return (
    <group matrixAutoUpdate={false} matrix={fit}>
      {pieces.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={outline ? OUTLINE : p.material} matrixAutoUpdate={false} matrix={p.matrix} castShadow={!outline} receiveShadow={!outline} raycast={outline ? () => {} : undefined} />
      ))}
    </group>
  );
}

/**
 * A prop on its own, origin at its bottom centre. With `outline`, a slightly larger inside-out
 * copy instead: drawn behind the real one, it reads as a glowing edge. Suspends while a model loads.
 */
export function PropModel({ kind, outline = 0 }: { kind: PropKind; outline?: number }) {
  const model = modelOf(kind);
  if (model) return <ModelProp kind={kind} model={model} outline={outline} />;
  return (
    <>
      {kind.parts.map((part, i) => {
        const [x, y, z] = part.at ?? [0, 0, 0];
        const [w, h, d] = part.size;
        return (
          <mesh
            key={i}
            geometry={GEOMETRY[part.shape]}
            material={outline ? OUTLINE : partMaterial(part.surface, part.color)}
            position={[x, y - outline, z]}
            scale={[w + 2 * outline, h + 2 * outline, d + 2 * outline]}
            castShadow={!outline}
            receiveShadow={!outline}
            raycast={outline ? () => {} : undefined}
          />
        );
      })}
    </>
  );
}

// ---------- Every real one (instanced, pickable) ----------

interface Batch {
  key: string;
  geometry: BufferGeometry;
  material: Material;
  matrices: Matrix4[];
  props: number[];
}

function Batched({ batch }: { batch: Batch }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.props = batch.props;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [batch]);
  return <instancedMesh key={batch.matrices.length} ref={ref} args={[batch.geometry, batch.material, batch.matrices.length]} castShadow receiveShadow />;
}

/** Every placed piece drawn with `model`, as one instanced mesh per piece of the model (furniture too). */
export function ModelBatches({ model, placed }: { model: ModelKey; placed: { kind: PropKind; prop: MapProp; part?: number }[] }) {
  const pieces = useModelPieces(model);
  const batches = useMemo(
    () =>
      pieces.map((piece, i): Batch => ({
        key: `${model}-${i}`,
        geometry: piece.geometry,
        material: piece.material,
        matrices: placed.map(({ kind, prop, part }) => modelMatrix(kind, model, prop, part).multiply(piece.matrix)),
        props: placed.map(({ prop }) => prop.id),
      })),
    [pieces, placed, model],
  );
  return (
    <>
      {batches.map((b) => (
        <Batched key={b.key} batch={b} />
      ))}
    </>
  );
}

/** Every thing to hide as in the house. Suspends while models load. */
export function PropArt({ map, below = Infinity }: { map: HouseMap; below?: number }) {
  const { byModel, parts } = useMemo(() => {
    const byModel = new Map<ModelKey, { kind: PropKind; prop: MapProp }[]>();
    const parts = new Map<string, Batch>();
    for (const prop of map.props) {
      const kind = map.kinds[prop.kind];
      if (!kind.disguise || prop.y >= below) continue;
      const model = modelOf(kind);
      if (model) {
        if (!byModel.has(model)) byModel.set(model, []);
        byModel.get(model)!.push({ kind, prop });
        continue;
      }
      for (const part of kind.parts) {
        const key = `${part.shape}:${part.surface ?? ""}:${part.color}`;
        let batch = parts.get(key);
        if (!batch) parts.set(key, (batch = { key, geometry: GEOMETRY[part.shape], material: partMaterial(part.surface, part.color), matrices: [], props: [] }));
        batch.matrices.push(partMatrix(part, prop));
        batch.props.push(prop.id);
      }
    }
    return { byModel: [...byModel.entries()], parts: [...parts.values()] };
  }, [map, below]);

  return (
    <>
      {parts.map((b) => (
        <Batched key={b.key} batch={b} />
      ))}
      {byModel.map(([model, placed]) => (
        <ModelBatches key={model} model={model} placed={placed} />
      ))}
    </>
  );
}
