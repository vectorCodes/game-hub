// Pair Pop's 3D scene: a floating board of tiles in a candy-coloured sky. Lazy-loaded with
// the play page, so three.js stays off the hub.
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Lightformer, Sparkles, useGLTF } from "@react-three/drei";
import { MathUtils, PerspectiveCamera, Vector3, type DirectionalLight } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ALL_PALS, palUrl, TILE, TIMING } from "../config";
import { usePairPop } from "../store";
import { skyTexture } from "./art";
import { Burst } from "./Burst";
import { Tile } from "./Tile";

ALL_PALS.forEach((id) => useGLTF.preload(palUrl(id)));

const PITCH = TILE.size + TILE.gap;
const FOV = 38;
/** Space kept clear at the sides and bottom of the screen (px); the top clears the HUD. */
const SIDE = { phone: 10, wide: 28 };
const BOTTOM = 18;

function boardSize(cols: number, rows: number) {
  return { w: cols * PITCH - TILE.gap, d: rows * PITCH - TILE.gap };
}

/** Upright screens get the board turned so its long side runs down the screen. */
function useBoardShape() {
  const { cols, rows } = usePairPop((s) => s.level);
  const portrait = useThree((s) => s.size.width < s.size.height);
  return portrait && cols > rows ? { cols: rows, rows: cols, portrait } : { cols, rows, portrait };
}

const probe = new PerspectiveCamera();
const corner = new Vector3();

/**
 * Where the camera sits and how far the picture is nudged so the whole board, pals standing
 * included, fits the screen below the HUD with a margin. Found by projecting the board's
 * corners and searching for the closest camera that keeps them all in.
 */
function frameBoard(cols: number, rows: number, width: number, height: number, hudTop: number, elevation: number) {
  const { w, d } = boardSize(cols, rows);
  const pad = 0.35;
  const points: [number, number, number][] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      points.push([sx * (w / 2 + pad), -0.3, sz * (d / 2 + pad)]);
      points.push([sx * (w / 2), TILE.palSize + 0.35, sz * (d / 2)]);
    }
  const side = width < 640 ? SIDE.phone : SIDE.wide;
  const availW = 2 * (1 - (2 * side) / width);
  const top = Math.min(hudTop + 8, height * 0.4);
  const availH = 2 * (1 - (top + BOTTOM) / height);
  // The free area's middle, in the same -1..1 units (up is +).
  const availMid = (BOTTOM - top) / height;

  probe.fov = FOV;
  probe.aspect = width / height;
  probe.updateProjectionMatrix();
  const measure = (dist: number) => {
    probe.position.set(0, Math.sin(elevation) * dist, Math.cos(elevation) * dist);
    probe.lookAt(0, 0, 0);
    probe.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      corner.set(...p).project(probe);
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
    }
    return { spanX: maxX - minX, spanY: maxY - minY, midY: (minY + maxY) / 2 };
  };
  let lo = 2, hi = 80;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    const m = measure(mid);
    if (m.spanX <= availW && m.spanY <= availH) hi = mid;
    else lo = mid;
  }
  const { midY } = measure(hi);
  return {
    position: new Vector3(0, Math.sin(elevation) * hi, Math.cos(elevation) * hi),
    // Pixels to slide the picture so the board's middle lands in the middle of the free area.
    shift: ((availMid - midY) * height) / 2,
  };
}

/** Frames the board whatever the screen shape, glides between sizes, and leans with the pointer. */
function CameraRig({ cols, rows }: { cols: number; rows: number }) {
  const camera = useThree((s) => s.camera as PerspectiveCamera);
  const size = useThree((s) => s.size);
  const hudTop = usePairPop((s) => s.hudTop);
  const goal = useRef({ position: new Vector3(0, 14, 7), shift: 0 });
  const shift = useRef(0);
  const look = useMemo(() => new Vector3(), []);
  const touch = useMemo(() => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches, []);

  useEffect(() => {
    const elevation = MathUtils.degToRad(size.width < size.height ? 70 : 62);
    goal.current = frameBoard(cols, rows, size.width, size.height, hudTop, elevation);
  }, [cols, rows, size.width, size.height, hudTop]);

  useEffect(() => () => camera.clearViewOffset(), [camera]);

  useFrame(({ pointer }, raw) => {
    const dt = Math.min(raw, 1 / 30);
    const t = goal.current.position;
    const k = 1 - Math.exp(-dt * 3.2);
    // No pointer lean on touch screens: the last tap would leave the board tilted.
    const lean = touch ? 0 : 1;
    camera.position.x = MathUtils.lerp(camera.position.x, t.x + pointer.x * 0.4 * lean, k);
    camera.position.y = MathUtils.lerp(camera.position.y, t.y + pointer.y * 0.25 * lean, k);
    camera.position.z = MathUtils.lerp(camera.position.z, t.z, k);
    camera.lookAt(look);
    shift.current = MathUtils.lerp(shift.current, goal.current.shift, k);
    camera.setViewOffset(size.width, size.height, 0, shift.current, size.width, size.height);
  });
  return null;
}

/** The slab the tiles sit on, sized to the level and gently bobbing. */
function Board({ cols, rows }: { cols: number; rows: number }) {
  const { w, d } = boardSize(cols, rows);
  const geo = useMemo(() => new RoundedBoxGeometry(w + 0.7, 0.3, d + 0.7, 5, 0.22), [w, d]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo} position-y={-0.15} receiveShadow>
        <meshStandardMaterial color="#e3d2b2" roughness={0.75} />
      </mesh>
      {/* A lip of colour under the top. */}
      <mesh geometry={geo} position-y={-0.38} scale={[1.02, 0.6, 1.02]}>
        <meshStandardMaterial color="#cc922f" roughness={0.45} />
      </mesh>
    </group>
  );
}

/** Tiles laid out on the board for this round. Mounted after every pal has loaded. */
function Tiles({ cols, rows }: { cols: number; rows: number }) {
  const round = usePairPop((s) => s.round);
  const tiles = usePairPop((s) => s.tiles);

  const layout = useMemo(() => {
    const { w, d } = boardSize(cols, rows);
    return tiles.map((_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = -w / 2 + TILE.size / 2 + c * PITCH;
      const z = -d / 2 + TILE.size / 2 + r * PITCH;
      return {
        position: [x, TILE.thickness / 2, z] as [number, number, number],
        // Deal from the top-left corner in a diagonal sweep.
        delay: (c + r) * TIMING.dealStagger * 2 + ((i * 7) % 5) * 0.01,
        wave: Math.hypot(x, z) * 0.09,
      };
    });
  }, [tiles, cols, rows]);

  // The deal has landed: on to the peek.
  useEffect(() => {
    if (!tiles.length) return;
    const longest = Math.max(...layout.map((l) => l.delay));
    const t = setTimeout(() => usePairPop.getState().dealt(), (longest + 0.7) * 1000);
    return () => clearTimeout(t);
    // Only a new board restarts this, not the board turning with the screen.
  }, [round, tiles.length]);

  return (
    <group key={round}>
      {layout.map((l, i) => (
        <Tile key={i} index={i} {...l} />
      ))}
    </group>
  );
}

function Lights({ span }: { span: number }) {
  const sun = useRef<DirectionalLight>(null);
  useEffect(() => {
    const cam = sun.current?.shadow.camera;
    if (!cam) return;
    cam.left = cam.bottom = -span;
    cam.right = cam.top = span;
    cam.updateProjectionMatrix();
  }, [span]);
  return (
    <>
      <hemisphereLight args={["#fff8ec", "#b9a27c", 1.1]} />
      <directionalLight
        ref={sun}
        position={[3.5, 9, 5]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={5}
      />
      <directionalLight position={[-6, 4, -3]} intensity={0.6} color="#86cbb4" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 4]} scale={[10, 4, 1]} color="#ffffff" onUpdate={(o) => o.lookAt(0, 0, 0)} />
        <Lightformer form="ring" intensity={1.6} position={[-6, 3, 2]} scale={4} color="#e8774f" onUpdate={(o) => o.lookAt(0, 0, 0)} />
        <Lightformer form="ring" intensity={1.6} position={[6, 3, -2]} scale={4} color="#86cbb4" onUpdate={(o) => o.lookAt(0, 0, 0)} />
      </Environment>
    </>
  );
}

/** Soft shapes drifting behind the board. */
function Decor({ span }: { span: number }) {
  const shapes = useMemo(
    () => [
      { pos: [-span - 1.6, -1.2, -1.5], color: "#d9582c", kind: "sphere", s: 0.55 },
      { pos: [span + 1.8, -0.6, -2.4], color: "#e2a940", kind: "torus", s: 0.5 },
      { pos: [-span - 0.6, -2.2, span * 0.6], color: "#3c947d", kind: "cube", s: 0.45 },
      { pos: [span + 1.1, -2.4, span * 0.7], color: "#f8f2e7", kind: "sphere", s: 0.4 },
      { pos: [-1.2, -1.6, -span - 2.2], color: "#cc922f", kind: "cube", s: 0.5 },
      { pos: [2.2, -1.8, -span - 2.6], color: "#c46a8a", kind: "torus", s: 0.45 },
    ],
    [span],
  );
  return (
    <>
      {shapes.map((d, i) => (
        <Float key={i} speed={1.4} rotationIntensity={1.4} floatIntensity={1.6} position={d.pos as [number, number, number]}>
          <mesh scale={d.s} castShadow>
            {d.kind === "sphere" ? <sphereGeometry args={[1, 32, 32]} /> : d.kind === "torus" ? <torusGeometry args={[0.8, 0.32, 20, 48]} /> : <boxGeometry args={[1.2, 1.2, 1.2]} />}
            <meshStandardMaterial color={d.color} roughness={0.3} />
          </mesh>
        </Float>
      ))}
      <Sparkles count={70} scale={[span * 4, 4, span * 4]} position-y={1} size={3.2} speed={0.35} opacity={0.55} color="#cc922f" />
    </>
  );
}

function Scene() {
  const { cols, rows } = useBoardShape();
  const span = Math.max(cols, rows) * PITCH * 0.5 + 0.6;
  return (
    <>
      <primitive attach="background" object={skyTexture} />
      <CameraRig cols={cols} rows={rows} />
      <Lights span={span + 1} />
      <Float speed={1.1} rotationIntensity={0.08} floatIntensity={0.25} floatingRange={[-0.05, 0.05]}>
        <Board cols={cols} rows={rows} />
        <Suspense fallback={null}>
          <Tiles cols={cols} rows={rows} />
        </Suspense>
      </Float>
      <Burst />
      <Decor span={span} />
    </>
  );
}

export default function Game() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 100, position: [0, 14, 7] }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onPointerMissed={() => (document.body.style.cursor = "")}
    >
      <Scene />
    </Canvas>
  );
}
