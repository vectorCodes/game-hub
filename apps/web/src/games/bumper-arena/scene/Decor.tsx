// Kenney props around each arena, just outside the edge (they never touch the rings). Picnic
// Plate: giant food floating round the plate, a fork and knife either side. Ice Floe: little
// snow islands with trees, snowmen, penguins and presents, and falling snow. Spinner: a
// minigolf windmill on the post, flags round the rim, a castle off in the sky. Hex Hive:
// honey jars, little grassy flower islands and bees circling the hive.
import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, BufferAttribute, BufferGeometry, Group, Vector3, type Mesh } from "three";
import { game, useBumper } from "../store";

const url = (kit: string, model: string) => `/bumper-arena/${kit}/${model}.glb`;
const food = (m: string) => url("food-kit", m);
const holiday = (m: string) => url("holiday-kit", m);
const pets = (m: string) => url("cube-pets", m);
const golf = (m: string) => url("minigolf-kit", m);
const nature = (m: string) => url("nature-kit", m);

interface PropProps {
  src: string;
  /** Largest side (m). */
  size: number;
  position: [number, number, number];
  /** Yaw (radians), and an optional tilt about x. */
  yaw?: number;
  tilt?: number;
  /** Bob up and down this far (m). */
  bob?: number;
}

/** A Kenney model scaled to `size`, standing on its base at `position`, gently bobbing. */
function Prop({ src, size, position, yaw = 0, tilt = 0, bob = 0 }: PropProps) {
  const { scene } = useGLTF(src);
  const ref = useRef<Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const object = useMemo(() => {
    const model = scene.clone(true);
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
    });
    const dims = new Box3().setFromObject(model).getSize(new Vector3());
    model.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z));
    const box = new Box3().setFromObject(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const holder = new Group();
    holder.add(model);
    return holder;
  }, [scene, size]);

  useFrame(({ clock }) => {
    if (ref.current && bob) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.8 + phase) * bob;
  });

  return (
    <group ref={ref} position={position} rotation={[tilt, yaw, 0]}>
      <primitive object={object} />
    </group>
  );
}

/** A point `out` metres past the edge, `deg` degrees round from the camera's side. */
const around = (r: number, deg: number, out: number, y: number): [number, number, number] => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * (r + out), y, Math.cos(a) * (r + out)];
};

function PicnicDecor({ r }: { r: number }) {
  const items: [string, number, number, number][] = [
    // model, size, angle, metres out
    ["watermelon", 5, 35, 4],
    ["sandwich", 4.5, 80, 4],
    ["cupcake", 4, 135, 3.5],
    ["apple", 3.2, 160, 3],
    ["cheese", 4, 205, 4],
    ["soda-glass", 5, 245, 3.5],
    ["strawberry", 2.8, 300, 3],
    ["cookie-chocolate", 4, 330, 4],
    ["cherries", 3, 185, 6.5],
    ["pie", 5, 15, 7.5],
  ];
  return (
    <>
      {items.map(([m, size, deg, out]) => (
        <Prop key={m} src={food(m)} size={size} position={around(r, deg, out, -1.2)} yaw={(deg * Math.PI) / 90} bob={0.3} />
      ))}
      {/* The place setting: a fork on the left, a knife on the right, lying flat. */}
      <Prop src={food("utensil-fork")} size={r * 0.9} position={[-r * 1.45 - 1.5, -0.6, 0]} bob={0.15} />
      <Prop src={food("utensil-knife")} size={r * 0.9} position={[r * 1.45 + 1.5, -0.6, 0]} bob={0.15} />
    </>
  );
}

/** One small floating snow island, with things standing on it. */
function SnowIsle({ at, things }: { at: [number, number, number]; things: [string, number, number, number][] }) {
  return (
    <group position={at}>
      <Prop src={holiday("snow-flat-large")} size={6} position={[0, -0.6, 0]} />
      {things.map(([src, size, x, z], i) => (
        <Prop key={i} src={src} size={size} position={[x, -0.1, z]} yaw={i * 1.7} />
      ))}
    </group>
  );
}

function Snowfall({ r }: { r: number }) {
  const count = 600;
  const span = r * 2 + 16;
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * span;
      pos[i * 3 + 1] = Math.random() * 18 - 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * span;
    }
    g.setAttribute("position", new BufferAttribute(pos, 3));
    return g;
  }, [span]);

  useFrame(({ clock }, dt) => {
    const pos = geometry.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) - dt * (0.8 + (i % 5) * 0.15);
      if (y < -6) y += 18;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(clock.elapsedTime * 0.6 + i) * dt * 0.2);
    }
    pos.needsUpdate = true;
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#ffffff" size={0.14} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

function IceDecor({ r }: { r: number }) {
  return (
    <>
      <SnowIsle at={around(r, 30, 5, -0.8)} things={[[holiday("tree-snow-a"), 4.5, -1, -0.5], [pets("animal-penguin"), 1.4, 1.3, 1]]} />
      <SnowIsle at={around(r, 95, 5.5, -1.2)} things={[[holiday("snowman-hat"), 2.6, 0, 0], [holiday("present-a-cube"), 0.9, 1.6, 0.8], [holiday("present-b-round"), 0.8, -1.4, 1.2]]} />
      <SnowIsle at={around(r, 160, 5, -0.6)} things={[[pets("animal-polar"), 2.2, 0, 0], [holiday("rocks-medium"), 1.5, -1.8, -1]]} />
      <SnowIsle at={around(r, 215, 5.5, -1)} things={[[holiday("tree-decorated-snow"), 4.5, 0, -0.6], [pets("animal-penguin"), 1.3, 1.6, 1.2], [pets("animal-penguin"), 1.1, -1.5, 1.4]]} />
      <SnowIsle at={around(r, 270, 5, -0.9)} things={[[holiday("reindeer"), 2.6, 0, 0], [holiday("sled"), 2, -1.6, 1]]} />
      <SnowIsle at={around(r, 330, 5.5, -1.1)} things={[[holiday("tree-snow-b"), 4, 0.8, -0.6], [holiday("snowman"), 2, -1.4, 0.8]]} />
      <Snowfall r={r} />
    </>
  );
}

/** Spinner: the windmill turns with the bar. */
function Windmill() {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current && game.sim) ref.current.rotation.y = game.sim.spinner.angle;
  });
  return (
    <group ref={ref} position={[0, 1.1, 0]}>
      <Prop src={golf("windmill")} size={3.2} position={[0, 0, 0]} />
    </group>
  );
}

function SpinnerDecor({ r }: { r: number }) {
  const flags = ["flag-large-red", "flag-large-blue", "flag-large-green"];
  return (
    <>
      <Windmill />
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i}>
          <Prop src={golf("obstacle-diamond")} size={1.6} position={around(r, i * 40 + 20, 1.6, -1)} bob={0.2} />
          <Prop src={golf(flags[i % 3])} size={3} position={around(r, i * 40 + 20, 1.6, -0.3)} bob={0.2} />
        </group>
      ))}
      <Prop src={golf("castle")} size={9} position={around(r, 200, 12, -3)} yaw={0.6} bob={0.4} />
      <Prop src={golf("ball-red")} size={2} position={around(r, 60, 5, 1)} bob={0.6} />
      <Prop src={golf("ball-blue")} size={1.6} position={around(r, 300, 6, 2)} bob={0.6} />
    </>
  );
}

/** A bee circling the hive. */
function Bee({ radius, height, speed, offset }: { radius: number; height: number; speed: number; offset: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const a = clock.elapsedTime * speed + offset;
    g.position.set(Math.sin(a) * radius, height + Math.sin(clock.elapsedTime * 3 + offset) * 0.4, Math.cos(a) * radius);
    g.rotation.y = a + (speed > 0 ? Math.PI / 2 : -Math.PI / 2);
  });
  return (
    <group ref={ref}>
      <Prop src={pets("animal-bee")} size={1.2} position={[0, 0, 0]} />
    </group>
  );
}

function FlowerIsle({ at }: { at: [number, number, number] }) {
  return (
    <group position={at}>
      <mesh position-y={-0.7} castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 1.4, 1.4, 10]} />
        <meshStandardMaterial color="#9a6b43" roughness={0.9} flatShading />
      </mesh>
      <mesh position-y={0.02} receiveShadow>
        <cylinderGeometry args={[2.25, 2.25, 0.1, 10]} />
        <meshStandardMaterial color="#7cc46a" roughness={0.9} flatShading />
      </mesh>
      <Prop src={nature("flower_yellowA")} size={1.6} position={[-0.8, 0, -0.5]} />
      <Prop src={nature("flower_redA")} size={1.4} position={[0.9, 0, 0.6]} />
      <Prop src={nature("flower_purpleA")} size={1.3} position={[0.6, 0, -0.9]} />
      <Prop src={nature("mushroom_redGroup")} size={1.2} position={[-0.8, 0, 0.9]} />
    </group>
  );
}

function HexDecor({ r }: { r: number }) {
  return (
    <>
      <Prop src={food("honey")} size={6} position={around(r, 40, 6, -2)} yaw={0.4} tilt={0.45} bob={0.3} />
      <Prop src={food("honey")} size={5} position={around(r, 215, 6.5, -2.5)} yaw={-0.6} tilt={0.45} bob={0.3} />
      <FlowerIsle at={around(r, 110, 5, -0.5)} />
      <FlowerIsle at={around(r, 160, 6, -1)} />
      <FlowerIsle at={around(r, 290, 5, -0.4)} />
      <FlowerIsle at={around(r, 340, 6, -1.2)} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Bee key={i} radius={r + 1.5 + (i % 3)} height={2.5 + (i % 2) * 1.5} speed={(i % 2 ? 1 : -1) * (0.25 + i * 0.05)} offset={i * 1.3} />
      ))}
    </>
  );
}

export function Decor() {
  useBumper((s) => s.round);
  const sim = game.sim;
  if (!sim) return null;
  const r = sim.startRadius;
  const id = sim.map.id;
  return (
    // The props load in the background: the arena shows straight away and they pop in.
    <Suspense fallback={null}>
      <group key={`${id}:${Math.round(r)}`}>
        {id === "picnic-plate" && <PicnicDecor r={r} />}
        {id === "ice-floe" && <IceDecor r={r} />}
        {id === "spinner" && <SpinnerDecor r={r} />}
        {id === "hex-hive" && <HexDecor r={r} />}
      </group>
    </Suspense>
  );
}
