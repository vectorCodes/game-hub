// Draws the tower from the simulation's state: the column, every platform with its
// decorations, the saws and spikes, and the coins. Floors far from the climber are hidden.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { TOWER, ZONES, zoneOf } from "../config";
import type { HazardState, PlatformState } from "../sim";
import { floorAt, type Deco, type Tower } from "../tower";
import { materialsOf, useKit, useSim } from "./shared";

/** Floors drawn above and below the climber. */
const VIEW_FLOORS = 16;
const S = TOWER.pieceScale;
const zoneById = (id: string) => ZONES.find((z) => z.id === id)!;

const near = (floor: number, height: number) => Math.abs(floor - height) < VIEW_FLOORS;
/** A spring sits on its platform, so the platform is drawn this much lower: you land on the spring. */
const SPRING_HEIGHT = 0.33 * S * 0.9;

/** The column the tower spirals round, stacked from the kit's tall blocks. */
export function Core({ tower }: { tower: Tower }) {
  const blocks = useMemo(() => {
    const step = 2 * 1.95;
    const top = tower.floorTops[tower.floorTops.length - 1] - 0.6;
    const out: { y: number; floor: number }[] = [];
    for (let y = -7.5; y < top; y += step) out.push({ y: Math.min(y, top - step), floor: floorAt(tower, y + step) });
    return out;
  }, [tower]);
  return (
    <>
      {blocks.map((b, i) => (
        <CoreBlock key={i} y={b.y} floor={b.floor} turn={i} />
      ))}
    </>
  );
}

function CoreBlock({ y, floor, turn }: { y: number; floor: number; turn: number }) {
  const sim = useSim();
  const zone = zoneOf(Math.floor(floor));
  const model = useKit(zone.core, zone.tint);
  const group = useRef<Group>(null);
  useFrame(() => {
    // The column reaches further than the platforms: it's the backdrop.
    if (group.current) group.current.visible = Math.abs(floor - sim.player.height) < VIEW_FLOORS + 8;
  });
  return (
    <group ref={group} position={[0, y, 0]} rotation-y={(turn * Math.PI) / 4} scale={1.95}>
      <primitive object={model} />
    </group>
  );
}

export function Platforms() {
  const sim = useSim();
  return (
    <>
      {sim.platforms.map((ps) => (
        <PlatformView key={ps.p.id} ps={ps} />
      ))}
    </>
  );
}

function Piece({ piece, tint, own, x = 0, onMaterials }: { piece: string; tint: string; own: boolean; x?: number; onMaterials?: (m: ReturnType<typeof materialsOf>) => void }) {
  const model = useKit(piece, tint, own);
  useEffect(() => onMaterials?.(materialsOf(model)), [model, onMaterials]);
  return <primitive object={model} position={[x, 0, 0]} />;
}

function DecoView({ d, tint, top }: { d: Deco; tint: string; top: number }) {
  const model = useKit(d.piece, tint);
  return <primitive object={model} position={[d.x, top, d.z]} rotation-y={d.yaw} scale={d.scale} />;
}

function Spring({ ps, top }: { ps: PlatformState; top: number }) {
  const sim = useSim();
  const model = useKit("spring");
  const group = useRef<Group>(null);
  useFrame(() => {
    const since = sim.t - ps.springAt;
    const stretch = since < 0.35 ? Math.sin((since / 0.35) * Math.PI) : 0;
    group.current?.scale.set(S * 0.9, S * 0.9 * (1 + stretch * 0.9), S * 0.9);
  });
  return (
    <group ref={group} position={[0, top, 0]}>
      <primitive object={model} />
    </group>
  );
}

function PlatformView({ ps }: { ps: PlatformState }) {
  const sim = useSim();
  const p = ps.p;
  const zone = zoneById(p.zone);
  const fades = p.kind === "crumble" || p.kind === "vanish";
  const group = useRef<Group>(null);
  const materials = useRef<ReturnType<typeof materialsOf>>([]);
  const collect = useMemo(() => (m: ReturnType<typeof materialsOf>) => void materials.current.push(...m), []);
  // Crumbling ledges look cracked and dry; vanishing ones glow faintly.
  const tint = p.kind === "crumble" ? "#d9b48f" : p.kind === "vanish" ? "#c9d8ff" : zone.tint;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = near(p.floor, sim.player.height);
    if (!g.visible) return;
    let x = ps.x;
    let y = ps.top - p.h - (p.kind === "spring" ? SPRING_HEIGHT : 0);
    let opacity = 1;
    if (p.kind === "crumble" && ps.crumbleAt !== null) {
      const since = sim.t - ps.crumbleAt;
      if (since < 0.65) {
        x += Math.sin(sim.t * 70) * 0.05;
      } else {
        y -= (since - 0.65) ** 2 * 9;
        opacity = Math.max(0, 1 - (since - 0.65) * 1.4);
      }
    } else if (p.kind === "vanish") {
      opacity = !ps.solid ? 0.12 : ps.warn ? (Math.sin(sim.t * 32) > 0 ? 1 : 0.35) : 1;
    }
    g.position.set(x, y, ps.z);
    if (fades) {
      for (const m of materials.current) {
        m.opacity = opacity;
        m.depthWrite = opacity > 0.5;
      }
    }
  });

  return (
    <group ref={group} rotation-y={p.yaw}>
      <group scale={S}>
        {p.tiles === 2 ? (
          <>
            <Piece piece={p.piece} tint={tint} own={fades} x={-0.5} onMaterials={collect} />
            <Piece piece={p.piece} tint={tint} own={fades} x={0.5} onMaterials={collect} />
          </>
        ) : (
          <Piece piece={p.piece} tint={tint} own={fades} onMaterials={collect} />
        )}
      </group>
      {p.kind === "spring" && <Spring ps={ps} top={p.h} />}
      {p.deco.map((d, i) => (
        <DecoView key={i} d={d} tint={zone.tint} top={p.h} />
      ))}
    </group>
  );
}

export function Hazards() {
  const sim = useSim();
  return (
    <>
      {sim.hazards.map((hs) => (hs.h.type === "saw" ? <Saw key={hs.h.id} hs={hs} /> : <Spikes key={hs.h.id} hs={hs} />))}
    </>
  );
}

function Saw({ hs }: { hs: HazardState }) {
  const sim = useSim();
  const model = useKit("saw");
  const group = useRef<Group>(null);
  const blade = useRef<Group>(null);
  const yaw = sim.platforms[hs.h.platform].p.yaw;
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = near(hs.h.floor, sim.player.height);
    g.position.set(hs.x, hs.y, hs.z);
    if (blade.current) blade.current.rotation.z = -hs.spin;
  });
  return (
    <group ref={group} rotation-y={yaw}>
      <group ref={blade} scale={S * 0.95}>
        <primitive object={model} />
      </group>
    </group>
  );
}

function Spikes({ hs }: { hs: HazardState }) {
  const sim = useSim();
  const model = useKit("trap-spikes");
  const group = useRef<Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = near(hs.h.floor, sim.player.height);
    // Sunk into the platform when retracted.
    g.position.set(hs.x, hs.y - 0.34 * (1 - hs.extend), hs.z);
  });
  return (
    <group ref={group} scale={S * 1.3}>
      <primitive object={model} />
    </group>
  );
}

export function Coins() {
  const sim = useSim();
  return (
    <>
      {sim.coins.map((c) => (
        <CoinView key={c.id} id={c.id} x={c.x} y={c.y} z={c.z} floor={c.floor} />
      ))}
    </>
  );
}

function CoinView({ id, x, y, z, floor }: { id: number; x: number; y: number; z: number; floor: number }) {
  const sim = useSim();
  const model = useKit("coin-gold");
  const group = useRef<Group>(null);
  const takenAt = useRef<number | null>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (sim.taken.has(id) && takenAt.current === null) takenAt.current = sim.t;
    const since = takenAt.current === null ? 0 : sim.t - takenAt.current;
    g.visible = near(floor, sim.player.height) && since < 0.3;
    if (!g.visible) return;
    // Collected: a quick pop upwards.
    const pop = since / 0.3;
    g.position.set(x, y - 0.3 + Math.sin(sim.t * 2.4 + id) * 0.08 + pop * 0.8, z);
    g.rotation.y = sim.t * 2.6 + id + pop * 10;
    g.scale.setScalar(S * 1.15 * (1 - pop * 0.6));
  });
  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}
