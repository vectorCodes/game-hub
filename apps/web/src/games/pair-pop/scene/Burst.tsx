// Confetti: one instanced mesh of little paper bits for the whole board. Tiles call `burst`
// on a match; the pieces fly up, tumble and fall out of sight.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DynamicDrawUsage, Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from "three";

const COUNT = 420;
const GRAVITY = 9;
// GameHub accents: gold, sun, jade, rice, and a little plum.
const PALETTE = ["#e2a940", "#d9582c", "#3c947d", "#f8f2e7", "#c46a8a", "#eec266"];

interface Piece {
  life: number;
  pos: Vector3;
  vel: Vector3;
  rot: Euler;
  spin: Vector3;
  size: number;
}

const pieces: Piece[] = Array.from({ length: COUNT }, () => ({
  life: 0,
  pos: new Vector3(),
  vel: new Vector3(),
  rot: new Euler(),
  spin: new Vector3(),
  size: 1,
}));
const queue: { at: Vector3; color: string; amount: number; power: number }[] = [];
let cursor = 0;

/** Throws `amount` pieces up from `at`, mostly in `color`. */
export function burst(at: Vector3, color: string, amount = 34, power = 1) {
  queue.push({ at: at.clone(), color, amount, power });
}

const m = new Matrix4();
const q = new Quaternion();
const s = new Vector3();
const tint = new Color();

export function Burst() {
  const mesh = useRef<InstancedMesh>(null);
  const colors = useMemo(() => PALETTE.map((c) => new Color(c)), []);

  useFrame((_, raw) => {
    const inst = mesh.current;
    if (!inst) return;
    const dt = Math.min(raw, 1 / 30);

    while (queue.length) {
      const { at, color, amount, power } = queue.shift()!;
      for (let n = 0; n < amount; n++) {
        const i = cursor;
        cursor = (cursor + 1) % COUNT;
        const p = pieces[i];
        const a = Math.random() * Math.PI * 2;
        const out = (1.2 + Math.random() * 2.2) * power;
        p.life = 1.4 + Math.random() * 0.8;
        p.pos.copy(at).add(s.set((Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4));
        p.vel.set(Math.cos(a) * out, (3.5 + Math.random() * 3) * power, Math.sin(a) * out);
        p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        p.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
        p.size = 0.6 + Math.random() * 0.7;
        inst.setColorAt(i, n % 3 === 0 ? tint.set(color) : colors[Math.floor(Math.random() * colors.length)]);
      }
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < COUNT; i++) {
      const p = pieces[i];
      if (p.life <= 0) {
        m.makeScale(0, 0, 0);
        inst.setMatrixAt(i, m);
        continue;
      }
      p.life -= dt;
      // Paper: falls, but air drag keeps it slow and fluttery.
      p.vel.y -= GRAVITY * dt;
      p.vel.multiplyScalar(1 - 2.2 * dt);
      p.pos.addScaledVector(p.vel, dt);
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const k = Math.min(1, p.life * 2) * p.size;
      m.compose(p.pos, q.setFromEuler(p.rot), s.set(k, k, k));
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false} onUpdate={(i) => i.instanceMatrix.setUsage(DynamicDrawUsage)}>
      <planeGeometry args={[0.07, 0.11]} />
      <meshStandardMaterial side={2} roughness={0.5} metalness={0.1} />
    </instancedMesh>
  );
}
