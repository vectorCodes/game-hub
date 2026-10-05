// The power-up orbs floating over platforms, and what the active ones look like on the
// climber: a shield bubble, a magnet's pulsing ring, a halo while a double jump is ready,
// and a ring under the feet while floating on the feather.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { input } from "../input";
import { POWER, POWERUPS, type PowerupKind } from "../config";
import type { Powerup } from "../tower";
import { onSimEvent, useSim } from "./shared";

/** Floors drawn above and below the climber. */
const VIEW_FLOORS = 16;

/** Each kind's shape inside its glow, so they read apart at a glance. */
function Shape({ kind, color }: { kind: PowerupKind; color: string }) {
  const mat = <meshBasicMaterial color={color} toneMapped={false} />;
  switch (kind) {
    case "feather":
      return (
        <mesh rotation={[0, 0, -0.5]} scale={[0.55, 1.5, 0.3]}>
          <octahedronGeometry args={[0.2, 0]} />
          {mat}
        </mesh>
      );
    case "doubleJump":
      return (
        <>
          <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.15, 0.04, 8, 20]} />
            {mat}
          </mesh>
          <mesh position={[0, -0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.15, 0.04, 8, 20]} />
            {mat}
          </mesh>
        </>
      );
    case "shield":
      return (
        <mesh scale={[1, 1.2, 0.5]}>
          <octahedronGeometry args={[0.2, 0]} />
          {mat}
        </mesh>
      );
    case "magnet":
      return (
        <mesh rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.15, 0.06, 8, 16, Math.PI * 1.2]} />
          {mat}
        </mesh>
      );
  }
}

function PickupView({ o }: { o: Powerup }) {
  const sim = useSim();
  const group = useRef<Group>(null);
  const takenAt = useRef<number | null>(null);
  const { color } = POWERUPS[o.kind];

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const taken = sim.collected.has(o.id);
    // Dying puts the orb back.
    if (!taken) takenAt.current = null;
    else if (takenAt.current === null) takenAt.current = sim.t;
    const since = takenAt.current === null ? 0 : sim.t - takenAt.current;
    g.visible = Math.abs(o.floor - sim.player.height) < VIEW_FLOORS && since < 0.3;
    if (!g.visible) return;
    const pop = since / 0.3;
    g.position.set(o.x, o.y + Math.sin(sim.t * 2.2 + o.id) * 0.1 + pop * 0.7, o.z);
    g.rotation.y = sim.t * 2 + pop * 8;
    g.scale.setScalar(1 - pop * 0.7);
  });

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.36, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      </mesh>
      <Shape kind={o.kind} color={color} />
    </group>
  );
}

export function Pickups() {
  const sim = useSim();
  return (
    <>
      {sim.powerups.map((o) => (
        <PickupView key={o.id} o={o} />
      ))}
    </>
  );
}

/** What each active power-up looks like on the climber. */
export function PowerAuras() {
  const sim = useSim();
  const shield = useRef<Mesh>(null);
  const magnet = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const float = useRef<Mesh>(null);
  const burst = useRef<Mesh>(null);
  const burstAt = useRef(-10);

  useEffect(
    () =>
      onSimEvent((e, s) => {
        if (e.type === "airjump") burstAt.current = s.t;
      }),
    [],
  );

  useFrame(() => {
    const pl = sim.player;
    const fx = sim.effects;
    const alive = pl.dead <= 0;
    const t = sim.t;
    const set = (m: Mesh | null, visible: boolean, x = pl.x, y = pl.y, z = pl.z) => {
      if (!m) return false;
      m.visible = visible;
      if (visible) m.position.set(x, y, z);
      return visible;
    };

    // Shield bubble: flickers for its last three seconds, and after absorbing a hit.
    const flicker = sim.grace > 0 || (fx.shield > 0 && fx.shield < 3 && Math.floor(t * 8) % 2 === 0);
    if (set(shield.current, alive && (fx.shield > 0 || sim.grace > 0), pl.x, pl.y + 0.5, pl.z) && shield.current) {
      shield.current.scale.setScalar(0.72 + Math.sin(t * 3) * 0.03);
      (shield.current.material as MeshBasicMaterial).opacity = flicker ? 0.08 : 0.26;
    }

    // Magnet: rings that spread out to the pull radius, over and over.
    if (set(magnet.current, alive && fx.magnet > 0, pl.x, pl.y + 0.5, pl.z) && magnet.current) {
      const k = (t % 1.2) / 1.2;
      magnet.current.scale.setScalar(0.3 + k * (POWER.magnetRadius - 0.3));
      (magnet.current.material as MeshBasicMaterial).opacity = (1 - k) * 0.5;
    }

    // Double jump: a halo over the head while the extra jump is ready.
    if (set(halo.current, alive && fx.doubleJump > 0 && !pl.airJumped, pl.x, pl.y + 1.25, pl.z) && halo.current) {
      halo.current.rotation.z = t * 3;
    }

    // Feather: a ring beneath the feet while floating down.
    if (set(float.current, alive && fx.feather > 0 && input.jumpHeld && pl.vy < 0 && !pl.grounded, pl.x, pl.y + 0.05, pl.z) && float.current) {
      float.current.scale.setScalar(0.5 + Math.sin(t * 9) * 0.06);
    }

    // The ring that spreads from the feet on a mid-air jump.
    const since = t - burstAt.current;
    if (set(burst.current, since < 0.4, pl.x, pl.y + 0.05, pl.z) && burst.current) {
      burst.current.scale.setScalar(0.3 + (since / 0.4) * 1.1);
      (burst.current.material as MeshBasicMaterial).opacity = (1 - since / 0.4) * 0.7;
    }
  });

  return (
    <>
      <mesh ref={shield} visible={false}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color={POWERUPS.shield.color} transparent opacity={0.26} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={magnet} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.02, 6, 48]} />
        <meshBasicMaterial color={POWERUPS.magnet.color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={halo} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.03, 8, 24]} />
        <meshBasicMaterial color={POWERUPS.doubleJump.color} toneMapped={false} />
      </mesh>
      <mesh ref={float} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.04, 8, 32]} />
        <meshBasicMaterial color={POWERUPS.feather.color} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={burst} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.04, 8, 32]} />
        <meshBasicMaterial color={POWERUPS.doubleJump.color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
