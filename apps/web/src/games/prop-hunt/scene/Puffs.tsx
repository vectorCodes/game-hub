// Soft puffs: a cloud when you turn into a prop (or back), and dust when you land hard. One
// small pool of spheres, reused for every burst.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshBasicMaterial, SphereGeometry, type Mesh } from "three";
import type { HuntSim, SimEvent } from "../sim";

const POOL = 48;
const GEOMETRY = new SphereGeometry(0.5, 12, 8);

interface Puff {
  life: number;
  max: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
}

export function Puffs({ sim, subscribe }: { sim: HuntSim; subscribe: (l: (e: SimEvent) => void) => () => void }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const puffs = useMemo<Puff[]>(() => Array.from({ length: POOL }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0 })), []);
  const materials = useMemo(() => Array.from({ length: POOL }, () => new MeshBasicMaterial({ color: "#f6f1e7", transparent: true, depthWrite: false })), []);
  const cursor = useRef(0);

  useEffect(() => {
    const spawn = (n: number, opts: { y: number; spread: number; speed: number; up: number; size: number; life: number; color: string }) => {
      const pl = sim.player;
      for (let i = 0; i < n; i++) {
        const k = cursor.current;
        cursor.current = (k + 1) % POOL;
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const s = opts.speed * (0.6 + Math.random() * 0.5);
        Object.assign(puffs[k], {
          life: opts.life,
          max: opts.life,
          x: pl.x + Math.cos(a) * opts.spread,
          y: pl.y + opts.y * (0.4 + Math.random() * 0.8),
          z: pl.z + Math.sin(a) * opts.spread,
          vx: Math.cos(a) * s,
          vy: opts.up * (0.5 + Math.random()),
          vz: Math.sin(a) * s,
          size: opts.size * (0.7 + Math.random() * 0.6),
        });
        materials[k].color.set(opts.color);
      }
    };
    return subscribe((e) => {
      const h = sim.height;
      if (e.type === "become") spawn(16, { y: h * 0.5, spread: Math.max(0.3, sim.half), speed: 2.4, up: 0.8, size: 0.5 + h * 0.25, life: 0.7, color: "#f6f1e7" });
      if (e.type === "land" && e.speed > 9) spawn(8, { y: 0.05, spread: sim.half, speed: 1.8, up: 0.3, size: 0.25, life: 0.45, color: "#e9e1d3" });
    });
  }, [subscribe, sim, puffs, materials]);

  useFrame((_, dt) => {
    for (let i = 0; i < POOL; i++) {
      const p = puffs[i];
      const mesh = meshes.current[i];
      if (!mesh) continue;
      if (p.life <= 0) {
        mesh.visible = false;
        continue;
      }
      p.life -= dt;
      // Puffs slow down as they spread, like smoke.
      const drag = Math.exp(-dt * 4);
      p.vx *= drag;
      p.vy *= drag;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = 1 - p.life / p.max;
      mesh.visible = true;
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.setScalar(p.size * (0.6 + t * 0.9));
      materials[i].opacity = 0.85 * (1 - t) * (1 - t);
    }
  });

  return (
    <>
      {puffs.map((_, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} geometry={GEOMETRY} material={materials[i]} visible={false} />
      ))}
    </>
  );
}
