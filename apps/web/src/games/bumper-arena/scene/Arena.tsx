// The arenas, floating above the clouds. Picnic Plate: a giant plate on a gingham cloth. Ice
// Floe: a round floe of cracked ice. Spinner: a striped playground disc with a post in the
// middle and a bar sweeping round it. On these, sudden death breaks the rim off a ring at a
// time (flashing red just before) and the broken ring falls. Hex Hive: a honeycomb of tiles
// that shake as they crack under the rings, then drop.
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, Color, DoubleSide, Object3D, RepeatWrapping, SRGBColorSpace, type Group, type InstancedMesh, type Mesh, type MeshStandardMaterial } from "three";
import { HEX, SPINNER, type BumperMap } from "@shadow/shared";
import { game, onBumperEvent, useBumper } from "../store";

const DEPTH = 0.7;
const RIM = 0.35;
/** Gingham tile size (m): 4×4 checks. */
const TILE = 2.4;

interface Look {
  /** Draws the top onto a square canvas. */
  paint: (g: CanvasRenderingContext2D, size: number) => void;
  /** The pattern repeats every `tile` metres, anchored to the middle (null: one picture over the whole top). */
  tile: number | null;
  side: string;
  bottom: string;
  rim: string;
}

const LOOKS: Record<string, Look> = {
  "picnic-plate": {
    paint: (g, size) => {
      const n = 4;
      const s = size / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const stripes = (i % 2) + (j % 2);
          g.fillStyle = stripes === 2 ? "#d8504a" : stripes === 1 ? "#ec9f95" : "#fbf3e6";
          g.fillRect(i * s, j * s, s, s);
        }
      }
    },
    tile: TILE,
    side: "#efe3cf",
    bottom: "#e2d3bb",
    rim: "#f4ead8",
  },
  "ice-floe": {
    paint: (g, size) => {
      const grad = g.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
      grad.addColorStop(0, "#eef8fc");
      grad.addColorStop(1, "#bfe2ef");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      // Cracks: wandering lines from near the middle out to the edge.
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = size / 220;
      for (let i = 0; i < 14; i++) {
        let a = (i / 14) * Math.PI * 2 + rand() * 0.4;
        let r = size * (0.05 + rand() * 0.15);
        g.beginPath();
        g.moveTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r);
        while (r < size * 0.5) {
          r += size * (0.03 + rand() * 0.04);
          a += (rand() - 0.5) * 0.25;
          g.lineTo(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r);
        }
        g.stroke();
      }
      // Snow dust.
      g.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 400; i++) g.fillRect(rand() * size, rand() * size, size / 300, size / 300);
    },
    tile: null,
    side: "#9fd2e6",
    bottom: "#7dbfd8",
    rim: "#e6f5fb",
  },
  spinner: {
    paint: (g, size) => {
      const rings = 9;
      for (let i = rings; i > 0; i--) {
        g.fillStyle = i % 2 ? "#f2c14e" : "#3fa7a3";
        g.beginPath();
        g.arc(size / 2, size / 2, (size / 2) * (i / rings), 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = "rgba(42,34,22,0.12)";
      g.lineWidth = size / 160;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.beginPath();
        g.moveTo(size / 2, size / 2);
        g.lineTo(size / 2 + (Math.cos(a) * size) / 2, size / 2 + (Math.sin(a) * size) / 2);
        g.stroke();
      }
    },
    tile: null,
    side: "#e7d7b8",
    bottom: "#cdbb98",
    rim: "#f6efe0",
  },
};

function useTopTexture(look: Look) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = look.tile ? 128 : 1024;
    look.paint(c.getContext("2d")!, c.width);
    const tex = new CanvasTexture(c);
    if (look.tile) tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [look]);
}

interface Chunk {
  id: number;
  inner: number;
  outer: number;
}

let chunkId = 0;

/** A broken-off ring of the plate, falling and spinning away. */
function FallingChunk({ chunk, look, onDone }: { chunk: Chunk; look: Look; onDone: (id: number) => void }) {
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
        <meshStandardMaterial color={look.rim} roughness={0.6} side={DoubleSide} />
      </mesh>
      <mesh position-y={-DEPTH / 2}>
        <cylinderGeometry args={[chunk.outer, chunk.outer * 0.96, DEPTH, 64, 1, true]} />
        <meshStandardMaterial color={look.side} roughness={0.7} side={DoubleSide} />
      </mesh>
    </group>
  );
}

/** A round arena: its top, sides and underside, a rim that flashes and breaks off in sudden death. */
function Plate({ map }: { map: BumperMap }) {
  const look = LOOKS[map.id] ?? LOOKS["picnic-plate"];
  const round = useBumper((s) => s.round);
  const tex = useTopTexture(look);
  const plate = useRef<Group>(null);
  const rim = useRef<Mesh>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const shown = useRef(0);
  const icy = map.grip < 1;

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
    // A repeating pattern keeps its size as the plate shrinks; a picture shrinks with it.
    if (look.tile) {
      tex.repeat.set((r * 2) / look.tile, (r * 2) / look.tile);
      tex.offset.set(0.5 - r / look.tile, 0.5 - r / look.tile);
    }
    const mat = rim.current?.material as MeshStandardMaterial | undefined;
    if (mat) {
      const flash = sim.warning && Math.sin(clock.elapsedTime * 22) > 0;
      mat.color.set(flash ? "#e5483f" : look.rim);
      mat.emissive.set(flash ? "#7a1410" : "#000000");
    }
  });

  return (
    <group>
      <group ref={plate}>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[1, 96]} />
          <meshStandardMaterial map={tex} roughness={icy ? 0.15 : 0.85} metalness={icy ? 0.05 : 0} />
        </mesh>
        <mesh position-y={-DEPTH / 2} castShadow receiveShadow>
          <cylinderGeometry args={[1, 0.82, DEPTH, 96, 1, true]} />
          <meshStandardMaterial color={look.side} roughness={icy ? 0.2 : 0.6} side={DoubleSide} />
        </mesh>
        <mesh position-y={-DEPTH} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.82, 96]} />
          <meshStandardMaterial color={look.bottom} roughness={0.8} />
        </mesh>
      </group>
      <ScaledRim rimRef={rim} color={look.rim} />
      {chunks.map((c) => (
        <FallingChunk key={c.id} chunk={c} look={look} onDone={(id) => setChunks((cs) => cs.filter((x) => x.id !== id))} />
      ))}
    </group>
  );
}

/** The plate's rim: a band of fixed width at the edge, which flashes before it breaks off. */
function ScaledRim({ rimRef, color }: { rimRef: RefObject<Mesh | null>; color: string }) {
  const [radius, setRadius] = useState(0);
  useFrame(() => {
    const r = game.sim?.radius ?? 0;
    if (Math.abs(r - radius) > 1e-3) setRadius(r);
  });
  if (!radius) return null;
  return (
    <mesh ref={rimRef} rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
      <ringGeometry args={[radius - RIM, radius, 96]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
}

/** Spinner: the post in the middle and the bar sweeping round it, striped red and white a metre at a time. */
function SpinnerBar() {
  const bar = useRef<Group>(null);
  const [length, setLength] = useState(0);

  useFrame(() => {
    const sim = game.sim;
    if (!sim || !bar.current) return;
    bar.current.rotation.y = sim.spinner.angle;
    // The bar reaches just past the edge, and shortens with it.
    const want = Math.ceil(sim.radius + 1);
    if (want !== length) setLength(want);
  });

  return (
    <group>
      <mesh position-y={0.55} castShadow receiveShadow>
        <cylinderGeometry args={[SPINNER.hubRadius, SPINNER.hubRadius * 1.08, 1.1, 32]} />
        <meshStandardMaterial color="#3a3632" roughness={0.5} />
      </mesh>
      <mesh position-y={1.12}>
        <cylinderGeometry args={[SPINNER.hubRadius * 0.6, SPINNER.hubRadius * 0.6, 0.08, 32]} />
        <meshStandardMaterial color="#f2c14e" roughness={0.4} />
      </mesh>
      <group ref={bar}>
        {Array.from({ length: length * 2 }, (_, i) => (
          <mesh key={i} position={[0, 0.42, i - length + 0.5]} castShadow>
            <boxGeometry args={[SPINNER.halfWidth * 2, 0.45, 1]} />
            <meshStandardMaterial color={i % 2 ? "#fbf3e6" : "#d9482f"} roughness={0.45} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const HONEY = ["#f0b93c", "#e8ad2e", "#f5c556"];
const CRACK = new Color("#a8461f");

/** Hex Hive: one instanced honeycomb. Cracking tiles shake and darken; dropped ones fall away. */
function HexFloor() {
  const round = useBumper((s) => s.round);
  const mesh = useRef<InstancedMesh>(null);
  const [count, setCount] = useState(0);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useEffect(() => setCount(game.sim?.tiles.length ?? 0), [round]);

  useFrame(({ clock }) => {
    const sim = game.sim;
    const m = mesh.current;
    if (!sim || !m || sim.tiles.length !== count) return;
    const t = clock.elapsedTime;
    sim.tiles.forEach((tile, i) => {
      let y = -0.25;
      let jx = 0;
      let jz = 0;
      color.set(HONEY[i % HONEY.length]);
      if (tile.state === "up" && tile.wear > 0) color.lerp(CRACK, Math.min(0.35, (tile.wear / HEX.wearSeconds) * 0.35));
      if (tile.state === "cracking") {
        const k = Math.min(1, (sim.t - tile.at) / HEX.crackSeconds);
        jx = Math.sin(t * 60 + i) * 0.04 * k;
        jz = Math.cos(t * 53 + i) * 0.04 * k;
        color.lerp(CRACK, 0.35 + 0.5 * k);
      }
      if (tile.state === "down") {
        const fallen = sim.t - (tile.at + HEX.crackSeconds);
        y -= 0.5 * 18 * fallen * fallen;
        color.lerp(CRACK, 0.85);
      }
      dummy.position.set(tile.x + jx, y, tile.z + jz);
      dummy.scale.setScalar(y < -40 ? 0 : 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, color);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  if (!count) return null;
  return (
    <instancedMesh key={`${round}:${count}`} ref={mesh} args={[undefined, undefined, count]} castShadow receiveShadow>
      <cylinderGeometry args={[HEX.size * 0.95, HEX.size * 0.9, 0.5, 6]} />
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}

export function Arena() {
  useBumper((s) => s.round);
  const map = game.sim?.map;
  if (!map) return null;
  if (map.kind === "hex") return <HexFloor />;
  return (
    <>
      <Plate key={map.id} map={map} />
      {map.kind === "spinner" && <SpinnerBar />}
    </>
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
