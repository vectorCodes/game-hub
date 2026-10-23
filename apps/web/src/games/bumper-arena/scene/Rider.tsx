// One rider: a GameHub avatar sitting in a bumper ring, drawn from the sim every frame. It
// leans into its speed, squashes on hits, wobbles as its Wobble climbs (stars over its head
// past 100%), tumbles when it goes over the edge, and cheers when it wins.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useAnimations } from "@react-three/drei";
import { LoopRepeat, MathUtils, type AnimationAction, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { animateAccessories } from "../../../avatar/build";
import { useAvatar } from "../../../avatar/store";
import { useAvatarModel } from "../../../avatar/useAvatarModel";
import { angleDelta } from "../../sky-climb/ghosts";
import { game, ME, onBumperEvent, useBumper, type Entrant } from "../store";

/** Mini Characters are 0.67 units tall: big riders, so they read from the high camera. */
const CHARACTER_SCALE = 1.7;
const FADE = 0.15;

function clipFor(id: string): string {
  const sim = game.sim;
  const r = sim?.ring(id);
  if (!sim || !r) return "drive";
  if (r.state !== "in") return "fall";
  if (sim.phase === "over" && sim.winner === id) return "emote-yes";
  return "drive";
}

export function Rider({ entrant }: { entrant: Entrant }) {
  const own = useAvatar((s) => s.config);
  const { root: model, animations } = useAvatarModel(entrant.avatar ?? own);
  const root = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const yaw = useRef<Group>(null);
  const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const stars = useRef<Group>(null);
  const marker = useRef<Mesh>(null);
  const label = useRef<HTMLSpanElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const { actions } = useAnimations(animations, body);
  const current = useRef<{ name: string; action: AnimationAction | null }>({ name: "", action: null });
  const fx = useRef({ squash: 0, spin: 0, wobble: -1 });
  const mine = entrant.id === ME;

  useEffect(() => {
    model.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = true;
    });
  }, [model]);

  useEffect(() => {
    for (const action of Object.values(actions)) action?.setLoop(LoopRepeat, Infinity);
    current.current = { name: "", action: null };
  }, [actions]);

  useEffect(
    () =>
      onBumperEvent((e) => {
        if (e.type === "hit" && (e.a === entrant.id || e.b === entrant.id)) fx.current.squash = Math.min(1, 0.3 + e.power * 0.35);
        if (e.type === "fall" && e.id === entrant.id) fx.current.spin = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3);
      }),
    [entrant.id],
  );

  useFrame(({ clock }, dt) => {
    const sim = game.sim;
    const r = sim?.ring(entrant.id);
    const g = root.current;
    if (!sim || !r || !g || !tilt.current || !yaw.current) return;
    animateAccessories(model, dt);
    g.visible = r.y > -30;
    g.position.set(r.x, r.y, r.z);
    yaw.current.rotation.y += angleDelta(yaw.current.rotation.y, r.facing) * (1 - Math.exp(-dt * 12));

    const f = fx.current;
    const t = clock.elapsedTime;
    f.squash = Math.max(0, f.squash - dt * 4);
    const speed = Math.hypot(r.vx, r.vz) / sim.tuning.maxSpeed;
    const wob = r.wobble / 100;
    if (r.state === "in") {
      // Lean into the speed, wobble with the Wobble; braced rings sit low and steady.
      tilt.current.rotation.x = MathUtils.lerp(tilt.current.rotation.x, Math.min(1.5, speed) * 0.12 * Math.cos(r.facing), 1 - Math.exp(-dt * 8));
      tilt.current.rotation.z = MathUtils.lerp(tilt.current.rotation.z, -Math.min(1.5, speed) * 0.12 * Math.sin(r.facing), 1 - Math.exp(-dt * 8));
      tilt.current.rotation.z += Math.sin(t * 11 + entrant.id.length) * Math.min(1.5, wob) * 0.05;
    } else {
      tilt.current.rotation.x += f.spin * dt;
      tilt.current.rotation.z += f.spin * 0.4 * dt;
    }
    if (sim.phase === "countdown") tilt.current.rotation.set(0, 0, 0);
    const squash = f.squash * Math.abs(Math.sin(f.squash * 9));
    const brace = r.bracing ? 1 : 0;
    tilt.current.scale.set(1 + squash * 0.18 + brace * 0.06, 1 - squash * 0.22 - brace * 0.12, 1 + squash * 0.18 + brace * 0.06);

    const mat = ring.current?.material as MeshStandardMaterial | undefined;
    if (mat) {
      mat.emissive.set(r.dashLeft > 0 ? "#ffffff" : r.bracing ? "#2a2a2a" : "#000000");
      mat.emissiveIntensity = r.dashLeft > 0 ? 0.35 : r.bracing ? 0.6 : 0;
    }
    if (stars.current) {
      stars.current.visible = r.state === "in" && r.wobble >= 100;
      stars.current.rotation.y += dt * 5;
    }
    if (marker.current) marker.current.visible = r.state === "in";
    // No tags on the menu's backdrop, nor once a ring is out.
    if (tag.current) tag.current.style.visibility = r.state === "out" || useBumper.getState().mode === "menu" ? "hidden" : "";

    const name = clipFor(entrant.id);
    if (name !== current.current.name) {
      const next = actions[name];
      if (next) {
        current.current.action?.fadeOut(FADE);
        next.reset().fadeIn(FADE).play();
        current.current = { name, action: next };
      }
    }

    // The label only changes when the whole-number Wobble does.
    const w = Math.round(r.wobble);
    if (label.current && w !== f.wobble) {
      f.wobble = w;
      label.current.textContent = `${w}%`;
      label.current.style.color = w >= 100 ? "#d8342b" : w >= 50 ? "#c77a10" : "";
    }
  });

  return (
    <group ref={root}>
      {/* Your ring: a ring on the floor under it, and a bobbing arrow at the start. */}
      <mesh ref={marker} rotation-x={-Math.PI / 2} position-y={0.012}>
        <ringGeometry args={[0.72, 0.84, 40]} />
        <meshBasicMaterial color={mine ? "#ffffff" : entrant.color} transparent opacity={mine ? 0.95 : 0.45} />
      </mesh>
      <group ref={tilt}>
        <group ref={yaw}>
          <mesh ref={ring} position-y={0.26} rotation-x={Math.PI / 2} castShadow>
            <torusGeometry args={[0.43, 0.17, 14, 32]} />
            <meshStandardMaterial color={entrant.color} roughness={0.45} />
          </mesh>
          {/* The rubber bumper band round its middle. */}
          <mesh position-y={0.26} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.6, 0.035, 8, 40]} />
            <meshStandardMaterial color="#2d2a26" roughness={0.8} />
          </mesh>
          <mesh position-y={0.1} castShadow receiveShadow>
            <cylinderGeometry args={[0.46, 0.5, 0.16, 28]} />
            <meshStandardMaterial color="#3a3632" roughness={0.7} />
          </mesh>
          <group ref={body} position-y={0.12} scale={CHARACTER_SCALE}>
            <primitive object={model} />
          </group>
          <group ref={stars} position-y={1.3} visible={false}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[Math.sin((i / 3) * Math.PI * 2) * 0.3, 0, Math.cos((i / 3) * Math.PI * 2) * 0.3]} scale={0.07}>
                <octahedronGeometry />
                <meshBasicMaterial color="#ffd23f" />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      <Html position={[0, 1.95, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div ref={tag} className="flex flex-col items-center gap-0.5 leading-none whitespace-nowrap select-none">
          <span
            className={`rounded-xs px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.08em] uppercase ${mine ? "bg-ink text-rice" : "bg-rice/85 text-ink"}`}
            style={mine ? undefined : { boxShadow: `inset 0 -2px 0 ${entrant.color}` }}
          >
            {entrant.name}
          </span>
          <span ref={label} className="font-display text-base font-bold text-ink [text-shadow:0_0_3px_#fff,0_1px_0_#fff]">
            0%
          </span>
        </div>
      </Html>
    </group>
  );
}
