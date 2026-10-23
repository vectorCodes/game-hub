// The arenas, floating above the clouds, each a slab in its map's outline with a rounded lip.
// Picnic Plate: a fluted plate on a gingham cloth. Ice Floe: a lumpy floe of cracked ice with
// icicles under it. Spinner: a striped carousel with chasing bulbs round its petals, a post in
// the middle and a bar sweeping round it. On these, sudden death breaks the rim off a band at
// a time (flashing red just before) and the broken band falls. Hex Hive: a honeycomb of tiles
// that shake as they crack under the rings, then drop.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, Color, ExtrudeGeometry, MeshStandardMaterial, Object3D, Path, RepeatWrapping, Shape, ShapeGeometry, SRGBColorSpace, Vector2, type Group, type InstancedMesh, type Material } from "three";
import { HEX, outlineAt, SPINNER, type BumperMap } from "@shadow/shared";
import { game, onBumperEvent, useBumper } from "../store";

const DEPTH = 0.55;
const RIM = 0.35;
/** Gingham tile size (m): 4×4 checks. */
const TILE = 2.4;

interface Look {
  /** Draws the top onto a square canvas. */
  paint: (g: CanvasRenderingContext2D, size: number) => void;
  /** The pattern repeats every `tile` metres, anchored to the middle (null: one picture over the whole top). */
  tile: number | null;
  side: string;
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
    rim: "#f6efe0",
  },
};

function useTopTexture(look: Look) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = look.tile ? 128 : 1024;
    look.paint(c.getContext("2d")!, c.width);
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [look]);
}

/** Bevel round the plate's top edge: how far it reaches out and down (m). */
const BEVEL = { size: 0.22, thickness: 0.16 };
const STEPS = 220;

/**
 * The map's outline at `radius`, as a shape in the extrude's plane: an extruded shape is
 * turned to lie flat (rotation x = -90°), which maps the shape's (x, y) to the world's (x, -z).
 */
function outlineShape(map: BumperMap, radius: number, hole?: number): Shape {
  const ring = (r: number) => {
    const pts: Vector2[] = [];
    for (let i = 0; i < STEPS; i++) {
      const a = (i / STEPS) * Math.PI * 2;
      const d = r * outlineAt(map, a);
      pts.push(new Vector2(Math.sin(a) * d, -Math.cos(a) * d));
    }
    return pts;
  };
  const shape = new Shape(ring(radius));
  if (hole) shape.holes.push(new Path(ring(hole).reverse()));
  return shape;
}

/** The plate as a solid slab with a rounded lip, top at y = 0. Caps get the pattern, sides the side colour. */
function slab(map: BumperMap, radius: number, hole?: number) {
  return new ExtrudeGeometry(outlineShape(map, radius, hole), {
    depth: DEPTH,
    bevelEnabled: true,
    bevelSize: BEVEL.size,
    bevelThickness: BEVEL.thickness,
    bevelSegments: 4,
  });
}

interface Chunk {
  id: number;
  inner: number;
  outer: number;
}

let chunkId = 0;

/** A broken-off ring of the plate, falling and tumbling away. */
function FallingChunk({ chunk, map, materials, onDone }: { chunk: Chunk; map: BumperMap; materials: Material[]; onDone: (id: number) => void }) {
  const ref = useRef<Group>(null);
  const motion = useRef({ vy: 0, age: 0, tilt: (Math.random() - 0.5) * 0.8 });
  const geometry = useMemo(() => slab(map, chunk.outer, chunk.inner), [map, chunk]);
  useEffect(() => () => geometry.dispose(), [geometry]);
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
      <mesh geometry={geometry} material={materials} rotation-x={-Math.PI / 2} position-y={-(DEPTH + BEVEL.thickness)} />
    </group>
  );
}

/** A round-ish arena: the slab in the map's outline, a rim that flashes and breaks off in sudden death. */
function Plate({ map }: { map: BumperMap }) {
  const look = LOOKS[map.id] ?? LOOKS["picnic-plate"];
  const round = useBumper((s) => s.round);
  const tex = useTopTexture(look);
  const rim = useRef<MeshStandardMaterial>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [radius, setRadius] = useState(() => game.sim?.radius ?? 0);
  const icy = map.grip < 1;
  const start = game.sim?.startRadius ?? radius;

  // The pattern is laid out in metres, anchored to the middle: the edge eats into it.
  useMemo(() => {
    const k = look.tile ? 1 / look.tile : 1 / (2 * start * 1.15);
    tex.repeat.set(k, k);
    tex.offset.set(look.tile ? 0 : 0.5, look.tile ? 0 : 0.5);
  }, [tex, look, start]);

  const materials = useMemo(
    () => [
      new MeshStandardMaterial({ map: tex, roughness: icy ? 0.15 : 0.8, metalness: icy ? 0.05 : 0 }),
      new MeshStandardMaterial({ color: look.side, roughness: icy ? 0.2 : 0.6 }),
    ],
    [tex, look, icy],
  );
  const geometry = useMemo(() => (radius ? slab(map, radius) : null), [map, radius]);
  const band = useMemo(() => (radius ? new ShapeGeometry(outlineShape(map, radius, Math.max(0.5, radius - RIM))) : null), [map, radius]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => band?.dispose(), [band]);

  useEffect(() => {
    setChunks([]);
    setRadius(game.sim?.radius ?? 0);
  }, [round]);

  useEffect(
    () =>
      onBumperEvent((e) => {
        if (e.type !== "drop") return;
        setRadius((outer) => {
          setChunks((c) => [...c, { id: ++chunkId, inner: e.radius, outer }]);
          return e.radius;
        });
      }),
    [],
  );

  useFrame(({ clock }) => {
    const sim = game.sim;
    const mat = rim.current;
    if (!sim || !mat) return;
    const flash = sim.warning && Math.sin(clock.elapsedTime * 22) > 0;
    mat.color.set(flash ? "#e5483f" : look.rim);
    mat.emissive.set(flash ? "#7a1410" : "#000000");
  });

  if (!geometry || !band) return null;
  return (
    <group>
      <mesh geometry={geometry} material={materials} rotation-x={-Math.PI / 2} position-y={-(DEPTH + BEVEL.thickness)} castShadow receiveShadow />
      <mesh geometry={band} rotation-x={-Math.PI / 2} position-y={0.006} receiveShadow>
        <meshStandardMaterial ref={rim} color={look.rim} roughness={0.5} />
      </mesh>
      {map.id === "spinner" && <Bulbs map={map} radius={radius} />}
      {map.id === "ice-floe" && <Icicles map={map} radius={radius} />}
      {chunks.map((c) => (
        <FallingChunk key={c.id} chunk={c} map={map} materials={materials} onDone={(id) => setChunks((cs) => cs.filter((x) => x.id !== id))} />
      ))}
    </group>
  );
}

const BULBS = 72;
const BULB_ON = new Color("#fff1b8");
const BULB_OFF = new Color("#8a6f3a");

/** Spinner: a string of light bulbs round the rim, chasing. */
function Bulbs({ map, radius }: { map: BumperMap; radius: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < BULBS; i++) {
      const a = (i / BULBS) * Math.PI * 2;
      const d = (radius - RIM / 2) * outlineAt(map, a);
      dummy.position.set(Math.sin(a) * d, 0.07, Math.cos(a) * d);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [map, radius, dummy]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const step = Math.floor(clock.elapsedTime * 8);
    for (let i = 0; i < BULBS; i++) m.setColorAt(i, color.copy((i + step) % 3 === 0 ? BULB_ON : BULB_OFF));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BULBS]}>
      <sphereGeometry args={[0.09, 10, 8]} />
      <meshStandardMaterial emissive="#ffd36b" emissiveIntensity={0.6} roughness={0.3} />
    </instancedMesh>
  );
}

const ICICLES = 70;

/** Ice Floe: icicles hanging under the lip, longer here and shorter there. */
function Icicles({ map, radius }: { map: BumperMap; radius: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < ICICLES; i++) {
      const a = ((i + 0.5 * Math.sin(i * 7.3)) / ICICLES) * Math.PI * 2;
      const d = radius * outlineAt(map, a) + BEVEL.size * 0.3;
      const len = 0.5 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 1.6;
      dummy.position.set(Math.sin(a) * d, -(DEPTH + BEVEL.thickness * 2) - len / 2, Math.cos(a) * d);
      dummy.rotation.set(Math.PI, 0, 0);
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [map, radius, dummy]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, ICICLES]}>
      <coneGeometry args={[0.16, 1, 6]} />
      <meshStandardMaterial color="#dff3fb" roughness={0.1} transparent opacity={0.9} />
    </instancedMesh>
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
