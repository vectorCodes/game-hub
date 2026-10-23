// Picnic Plate: a giant plate on a gingham cloth, floating above the clouds. In sudden death
// its rim breaks off a ring at a time (flashing red just before), and the broken ring falls.
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, RepeatWrapping, SRGBColorSpace, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { game, onBumperEvent, useBumper } from "../store";

const DEPTH = 0.7;
const RIM = 0.35;
/** Gingham tile size (m): 4×4 checks. */
const TILE = 2.4;

function useGingham() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const n = 4;
    const s = c.width / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const stripes = (i % 2) + (j % 2);
        g.fillStyle = stripes === 2 ? "#d8504a" : stripes === 1 ? "#ec9f95" : "#fbf3e6";
        g.fillRect(i * s, j * s, s, s);
      }
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

interface Chunk {
  id: number;
  inner: number;
  outer: number;
}

let chunkId = 0;

/** A broken-off ring of the plate, falling and spinning away. */
function FallingChunk({ chunk, onDone }: { chunk: Chunk; onDone: (id: number) => void }) {
  const ref = useRef<Group>(null);
  const motion = useRef({ vy: 0, age: 0, tilt: (Math.random() - 0.5) * 0.8 });
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const m = motion.current;
    m.age += dt;
    m.vy -= 14 * dt;
    g.position.y += m.vy * dt;
    g.rotation.x += m.tilt * dt;
    if (m.age > 3) onDone(chunk.id);
  });
  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <ringGeometry args={[chunk.inner, chunk.outer, 64]} />
        <meshStandardMaterial color="#f4ead8" roughness={0.6} side={DoubleSide} />
      </mesh>
      <mesh position-y={-DEPTH / 2}>
        <cylinderGeometry args={[chunk.outer, chunk.outer * 0.96, DEPTH, 64, 1, true]} />
        <meshStandardMaterial color="#efe3cf" roughness={0.7} side={DoubleSide} />
      </mesh>
    </group>
  );
}

export function Arena() {
  const round = useBumper((s) => s.round);
  const tex = useGingham();
  const plate = useRef<Group>(null);
  const rim = useRef<Mesh>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const shown = useRef(0);

  useEffect(() => {
    setChunks([]);
    shown.current = 0;
  }, [round]);

  useEffect(
    () =>
      onBumperEvent((e) => {
        if (e.type === "drop") {
          const outer = shown.current;
          shown.current = e.radius;
          setChunks((c) => [...c, { id: ++chunkId, inner: e.radius, outer }]);
        }
      }),
    [],
  );

  useFrame(({ clock }) => {
    const sim = game.sim;
    if (!sim || !plate.current) return;
    if (shown.current === 0) shown.current = sim.radius;
    const r = shown.current;
    plate.current.scale.set(r, 1, r);
    // The cloth keeps its check size as the plate shrinks.
    tex.repeat.set((r * 2) / TILE, (r * 2) / TILE);
    tex.offset.set(0.5 - r / TILE, 0.5 - r / TILE);
    const mat = rim.current?.material as MeshStandardMaterial | undefined;
    if (mat) {
      const flash = sim.warning && Math.sin(clock.elapsedTime * 22) > 0;
      mat.color.set(flash ? "#e5483f" : "#f4ead8");
      mat.emissive.set(flash ? "#7a1410" : "#000000");
    }
  });

  return (
    <group>
      <group ref={plate}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[1, 96]} />
          <meshStandardMaterial map={tex} roughness={0.85} />
        </mesh>
        <mesh position-y={-DEPTH / 2} castShadow receiveShadow>
          <cylinderGeometry args={[1, 0.82, DEPTH, 96, 1, true]} />
          <meshStandardMaterial color="#efe3cf" roughness={0.6} side={DoubleSide} />
        </mesh>
        <mesh position-y={-DEPTH} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.82, 96]} />
          <meshStandardMaterial color="#e2d3bb" roughness={0.8} />
        </mesh>
      </group>
      <ScaledRim rimRef={rim} />
      {chunks.map((c) => (
        <FallingChunk key={c.id} chunk={c} onDone={(id) => setChunks((cs) => cs.filter((x) => x.id !== id))} />
      ))}
    </group>
  );
}

/** The plate's rim: a band of fixed width at the edge, which flashes before it breaks off. */
function ScaledRim({ rimRef }: { rimRef: RefObject<Mesh | null> }) {
  const [radius, setRadius] = useState(0);
  useFrame(() => {
    const r = game.sim?.radius ?? 0;
    if (Math.abs(r - radius) > 1e-3) setRadius(r);
  });
  if (!radius) return null;
  return (
    <mesh ref={rimRef} rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
      <ringGeometry args={[radius - RIM, radius, 96]} />
      <meshStandardMaterial color="#f4ead8" roughness={0.55} />
    </mesh>
  );
}

const CLOUDS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + i * 0.7;
  const d = 12 + ((i * 37) % 30);
  return { x: Math.sin(a) * d, z: Math.cos(a) * d - 6, y: -14 - ((i * 13) % 10), s: 2.2 + ((i * 7) % 5) * 0.6 };
});

/** Soft clouds far below: the drop you fall into. */
export function Clouds() {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01;
  });
  return (
    <group ref={ref}>
      {CLOUDS.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {[
            [0, 0, 0, 1],
            [0.9, -0.15, 0.2, 0.75],
            [-0.85, -0.2, -0.1, 0.7],
            [0.2, 0.25, -0.5, 0.65],
          ].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]} scale={[r, r * 0.6, r]}>
              <icosahedronGeometry args={[1, 1]} />
              <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

