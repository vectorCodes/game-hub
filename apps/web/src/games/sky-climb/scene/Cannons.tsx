// Launch cannons and the Updraft Canyon's rising air. The kit has no cannon, so it's built
// from a few low-poly shapes in the kit's colours: a wooden carriage, wheels, an iron barrel.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { makeRng, type Cannon, type Updraft } from "../tower";
import { onSimEvent, useFloorRange, useSim } from "./shared";

export function Cannons() {
  const sim = useSim();
  const [lo, hi] = useFloorRange();
  return (
    <>
      {sim.tower.cannons
        .filter((c) => c.floor >= lo && c.floor <= hi)
        .map((c) => (
          <CannonView key={c.id} c={c} />
        ))}
    </>
  );
}

const WOOD = "#8a5a35";
const WOOD_DARK = "#5e3b20";
const IRON = "#3b4150";
const GOLD = "#f4b94e";

function CannonView({ c }: { c: Cannon }) {
  const sim = useSim();
  const barrel = useRef<Group>(null);
  const pad = useRef<Mesh>(null);
  const firedAt = useRef(-10);
  // Never so steep it looks like a mortar, never so flat it looks like it'd hit the next floor.
  const pitch = Math.min(1.15, Math.max(0.55, c.pitch));

  useEffect(
    () =>
      onSimEvent((e, s) => {
        if (e.type === "cannonFire" && s.cannon?.cannon.id === c.id) firedAt.current = s.t;
      }),
    [c.id],
  );

  useFrame(() => {
    const ride = sim.cannon;
    const aiming = ride && ride.cannon.id === c.id && ride.phase === "load" ? ride : null;
    const since = sim.t - firedAt.current;
    // Trembles harder as the meter rises, kicks back on the shot.
    const shake = aiming ? Math.sin(sim.t * 40) * 0.025 * (0.3 + aiming.meter) : 0;
    const recoil = since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * 0.35 : 0;
    const b = barrel.current;
    if (b) {
      b.rotation.x = -pitch + shake;
      b.position.z = -recoil * Math.cos(pitch);
      b.position.y = 0.62 - recoil * Math.sin(pitch);
    }
    const p = pad.current;
    if (p) {
      const glow = aiming ? 0.9 : 0.35 + Math.sin(sim.t * 3) * 0.2;
      (p.material as MeshBasicMaterial).opacity = glow;
    }
  });

  return (
    <group position={[c.x, c.y, c.z]} rotation-y={c.facing}>
      {/* The spot to stand on: walk in and you're loaded. */}
      <mesh ref={pad} rotation-x={-Math.PI / 2} position-y={0.015}>
        <ringGeometry args={[0.62, 0.78, 32]} />
        <meshBasicMaterial color={GOLD} transparent depthWrite={false} side={DoubleSide} />
      </mesh>
      {/* Carriage and wheels. */}
      <mesh castShadow receiveShadow position-y={0.22}>
        <boxGeometry args={[0.7, 0.26, 0.95]} />
        <meshStandardMaterial color={WOOD} flatShading />
      </mesh>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} castShadow position={[x, 0.3, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.3, 0.3, 0.12, 10]} />
          <meshStandardMaterial color={WOOD_DARK} flatShading />
        </mesh>
      ))}
      {/* The barrel pivots on the carriage, pointing along the start of the shot. */}
      <group ref={barrel} position-y={0.62}>
        <mesh castShadow position-z={0.35} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.3, 0.38, 1.35, 12]} />
          <meshStandardMaterial color={IRON} metalness={0.5} roughness={0.45} flatShading />
        </mesh>
        <mesh position-z={1.03}>
          <torusGeometry args={[0.31, 0.06, 6, 14]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} emissive={GOLD} emissiveIntensity={0.25} />
        </mesh>
        <mesh position-z={-0.38}>
          <sphereGeometry args={[0.36, 10, 8]} />
          <meshStandardMaterial color={IRON} metalness={0.5} roughness={0.45} flatShading />
        </mesh>
      </group>
    </group>
  );
}

export function Updrafts() {
  const sim = useSim();
  const [lo, hi] = useFloorRange();
  return (
    <>
      {sim.tower.updrafts
        .filter((u) => u.floor >= lo && u.floor <= hi)
        .map((u) => (
          <UpdraftView key={u.id} u={u} />
        ))}
    </>
  );
}

const WISPS = 90;

/** A faint column with streaks of air spiralling up it. */
function UpdraftView({ u }: { u: Updraft }) {
  const sim = useSim();
  const height = u.top - u.bottom;
  const seeds = useMemo(() => {
    const rng = makeRng(`updraft:${u.id}`);
    return Array.from({ length: WISPS }, () => ({ a: rng() * Math.PI * 2, r: Math.sqrt(rng()) * u.radius, y: rng(), speed: 0.7 + rng() * 0.6 }));
  }, [u]);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(WISPS * 3), 3));
    return g;
  }, []);

  useFrame(() => {
    const pos = geometry.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < WISPS; i++) {
      const w = seeds[i];
      const y = (w.y + sim.t * 0.35 * w.speed) % 1;
      const a = w.a + y * 5;
      pos.setXYZ(i, Math.cos(a) * w.r, y * height, Math.sin(a) * w.r);
    }
    pos.needsUpdate = true;
  });

  return (
    <group position={[u.x, u.bottom, u.z]}>
      <points geometry={geometry}>
        <pointsMaterial color="#e3f2ff" size={0.14} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} />
      </points>
      <mesh position-y={height / 2}>
        <cylinderGeometry args={[u.radius, u.radius, height, 24, 1, true]} />
        <meshBasicMaterial color="#bfe3ff" transparent opacity={0.07} side={DoubleSide} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}
