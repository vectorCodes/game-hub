// Little bursts from a small pool of reused meshes: a puff where rings hit (bigger and
// starrier for dash hits), dust behind a dash, and a splash of colour at a knockout.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial } from "three";
import { onBumperEvent, useBumper } from "../store";

const POOL = 80;

interface Particle {
  life: number;
  max: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  size: number;
}

export function Puffs() {
  const meshes = useRef<(Mesh | null)[]>([]);
  const particles = useMemo<Particle[]>(() => Array.from({ length: POOL }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, size: 0 })), []);
  const cursor = useRef(0);

  useEffect(() => {
    const spawn = (n: number, at: { x: number; y: number; z: number }, color: string | string[], o: { speed: number; up: number; gravity: number; size: number; life: number }) => {
      for (let i = 0; i < n; i++) {
        const p = particles[cursor.current];
        const mesh = meshes.current[cursor.current];
        cursor.current = (cursor.current + 1) % POOL;
        const a = Math.random() * Math.PI * 2;
        const s = o.speed * (0.4 + Math.random() * 0.6);
        Object.assign(p, {
          life: o.life,
          max: o.life,
          ...at,
          vx: Math.cos(a) * s,
          vy: o.up * (0.5 + Math.random() * 0.7),
          vz: Math.sin(a) * s,
          gravity: o.gravity,
          size: o.size * (0.7 + Math.random() * 0.6),
        });
        if (mesh) (mesh.material as MeshBasicMaterial).color.set(Array.isArray(color) ? color[i % color.length] : color);
      }
    };
    return onBumperEvent((e, sim) => {
      if (e.type === "hit" && e.power > 0.3) {
        const at = { x: e.x, y: 0.35, z: e.z };
        if (e.dash) spawn(12, at, ["#ffffff", "#ffd23f"], { speed: 4, up: 2, gravity: 6, size: 0.12, life: 0.45 });
        else spawn(Math.min(8, 2 + Math.round(e.power * 3)), at, "#ffffff", { speed: 2.4, up: 1, gravity: 0, size: 0.12, life: 0.35 });
      }
      if (e.type === "dash") {
        const r = sim.ring(e.id);
        if (r) spawn(6, { x: r.x, y: 0.1, z: r.z }, "#f6efe2", { speed: 1.2, up: 0.4, gravity: 0, size: 0.14, life: 0.4 });
      }
      if (e.type === "out" && e.by) {
        const by = useBumper.getState().entrants.find((x) => x.id === e.by);
        const r = sim.ring(e.id);
        if (r && by) spawn(16, { x: r.x, y: Math.max(-6, r.y), z: r.z }, [by.color, "#ffffff"], { speed: 3, up: 5, gravity: 8, size: 0.14, life: 1 });
      }
    });
  }, [particles]);

  useFrame((_, dt) => {
    for (let i = 0; i < POOL; i++) {
      const p = particles[i];
      const mesh = meshes.current[i];
      if (!mesh) continue;
      if (p.life <= 0) {
        mesh.visible = false;
        continue;
      }
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      mesh.visible = true;
      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.setScalar(p.size * Math.max(0, p.life / p.max));
    }
  });

  return (
    <group>
      {particles.map((_, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}
