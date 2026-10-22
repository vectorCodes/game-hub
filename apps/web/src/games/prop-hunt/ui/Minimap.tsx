// The minimap: the floor you're on from above (rooms, walls, the doorways between them, and the
// stairs), with you as an arrow. North is up, which is where the camera faces at the start. M (or
// a tap) opens it large, with every room named. Nobody else is on it: it would give hiders away.
import { useEffect, useMemo, useRef, useState } from "react";
import { UPSTAIRS, type HouseMap } from "@shadow/shared";
import { useHunt } from "../store";
import type { HuntSim } from "../sim";

/** Room colours by name; anything else is plain indoors. */
const FILL: Record<string, string> = {
  Garden: "#5f8f45",
  "Side path": "#8d887d",
  Shed: "#7a5c40",
  Garage: "#6f6f6c",
  Hallway: "#b9ab92",
  Landing: "#b9ab92",
  Bathroom: "#9fb8bd",
  Kitchen: "#c9bfa8",
};
const INDOOR = "#a98a66";
const OUTDOORS = new Set(["Garden", "Side path", "Shed"]);
const WALL = "#f4efe6";
const STAIRS = "#f2c14e";

/** Walls are at least this tall; lower blocks are floors, steps and paving. */
const WALL_MIN = 2;

type Floor = "ground" | "first";

/** What the minimap draws for one floor, in world units (x across, z down). */
function plan(map: HouseMap, floor: Floor) {
  const base = floor === "ground" ? 0 : UPSTAIRS;
  const stairs = map.stairs;
  const onStairs = (b: { x0: number; z0: number; x1: number; z1: number }) => stairs.some((s) => b.x0 < s.x1 && b.x1 > s.x0 && b.z0 < s.z1 && b.z1 > s.z0);
  const walls = map.blocks.filter(
    // Starting at this floor (a lintel over a door starts higher, so doorways stay open), and not a step.
    (b) => b.color !== null && b.y1 - b.y0 > WALL_MIN && Math.abs(b.y0 - base) < 0.5 && !(floor === "ground" && onStairs(b)),
  );
  // Ground-floor rooms start below the floor; first-floor rooms start at it. Upstairs, the
  // garden still shows (faded), so you know which way is outside.
  const rooms = map.areas
    .filter((a) => (floor === "ground" ? a.y0 < 0 : a.y0 > 0 || OUTDOORS.has(a.name)))
    .map((a) => ({ ...a, faded: floor === "first" && a.y0 < 0 }));
  return { walls, rooms };
}

function bounds(map: HouseMap) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const a of map.areas) {
    x0 = Math.min(x0, a.x0);
    z0 = Math.min(z0, a.z0);
    x1 = Math.max(x1, a.x1);
    z1 = Math.max(z1, a.z1);
  }
  const pad = 1.5;
  return { x: x0 - pad, z: z0 - pad, w: x1 - x0 + pad * 2, h: z1 - z0 + pad * 2 };
}

/** Where a room's name goes: its middle, below the stairs if they're in the way, and low in the garden (clear of the shed). */
function labelZ(r: HouseMap["areas"][number], stairs: HouseMap["stairs"], unit: number) {
  if (r.name === "Garden") return r.z1 - 14 * unit;
  const s = stairs.find((s) => s.x0 < r.x1 && s.x1 > r.x0 && s.z0 < r.z1 && s.z1 > r.z0);
  return s ? (s.z1 + r.z1) / 2 : (r.z0 + r.z1) / 2;
}

function MapView({ sim, floor, px, big }: { sim: HuntSim; floor: Floor; px: number; big: boolean }) {
  const map = sim.map;
  const box = useMemo(() => bounds(map), [map]);
  const { walls, rooms } = useMemo(() => plan(map, floor), [map, floor]);
  const you = useRef<SVGGElement>(null);
  // World units per screen pixel: keeps the arrow and the text the same size at any map size.
  const unit = box.w / px;

  useEffect(() => {
    let id = 0;
    const loop = () => {
      const pl = sim.player;
      // Facing 0 looks along +z (down the map).
      you.current?.setAttribute("transform", `translate(${pl.x} ${pl.z}) rotate(${(-pl.facing * 180) / Math.PI})`);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [sim]);

  const a = 7 * unit;
  return (
    <svg viewBox={`${box.x} ${box.z} ${box.w} ${box.h}`} width={px} height={(px * box.h) / box.w} className="block">
      {rooms.map((r) => (
        <rect key={r.name} x={r.x0} y={r.z0} width={r.x1 - r.x0} height={r.z1 - r.z0} fill={FILL[r.name] ?? INDOOR} opacity={r.faded ? 0.25 : 0.85} />
      ))}
      {map.stairs.map((s, i) => {
        const steps = Math.round(s.z1 - s.z0);
        return (
          <g key={i}>
            <rect x={s.x0} y={s.z0} width={s.x1 - s.x0} height={s.z1 - s.z0} fill={STAIRS} opacity={0.9} />
            {Array.from({ length: steps - 1 }, (_, k) => {
              const z = s.z0 + ((k + 1) * (s.z1 - s.z0)) / steps;
              return <line key={k} x1={s.x0} x2={s.x1} y1={z} y2={z} stroke="#8a6a1f" strokeWidth={0.6 * unit} />;
            })}
          </g>
        );
      })}
      {walls.map((b, i) => (
        <rect key={i} x={b.x0} y={b.z0} width={b.x1 - b.x0} height={b.z1 - b.z0} fill={WALL} />
      ))}
      {big &&
        rooms
          .filter((r) => !r.faded)
          .map((r) => (
            <text
              key={r.name}
              x={(r.x0 + r.x1) / 2}
              y={labelZ(r, map.stairs, unit)}
              fontSize={12 * unit}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#1c1917"
              fontWeight={600}
              className="font-mono uppercase"
              style={{ paintOrder: "stroke", stroke: "#f4efe6", strokeWidth: 3 * unit, letterSpacing: 0.5 * unit }}
            >
              {r.name}
            </text>
          ))}
      {map.stairs.map((s, i) => {
        // The arrow points the way up on the ground floor, and the way down from the landing.
        const up = s.up === "+z" ? 1 : -1;
        const dir = floor === "ground" ? up : -up;
        const cx = (s.x0 + s.x1) / 2;
        const cz = (s.z0 + s.z1) / 2;
        const len = Math.min((s.z1 - s.z0) * 0.3, 18 * unit);
        return (
          <g key={i}>
            <path
              d={`M ${cx} ${cz - dir * len} L ${cx} ${cz + dir * len} M ${cx - 4 * unit} ${cz + dir * (len - 4 * unit)} L ${cx} ${cz + dir * len} L ${cx + 4 * unit} ${cz + dir * (len - 4 * unit)}`}
              stroke="#1c1917"
              strokeWidth={2 * unit}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {big && (
              <text x={s.x1 + 3 * unit} y={cz} fontSize={11 * unit} dominantBaseline="middle" fill="#1c1917" fontWeight={700} style={{ paintOrder: "stroke", stroke: STAIRS, strokeWidth: 3 * unit }}>
                {floor === "ground" ? "Stairs up" : "Stairs down"}
              </text>
            )}
          </g>
        );
      })}
      <g ref={you}>
        <circle r={a * 1.25} fill="#f2c14e" opacity={0.35} />
        <path d={`M 0 ${a} L ${-a * 0.75} ${-a * 0.7} L 0 ${-a * 0.25} L ${a * 0.75} ${-a * 0.7} Z`} fill="#fff7e0" stroke="#1c1917" strokeWidth={1.4 * unit} strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Top right. */
export function Minimap({ sim }: { sim: HuntSim }) {
  const level = useHunt((s) => s.level);
  const floor: Floor = level === "first floor" ? "first" : "ground";
  const [big, setBig] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyM" && !e.repeat && !(e.target instanceof HTMLInputElement)) setBig((b) => !b);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const label = floor === "ground" ? "Ground floor" : "First floor";
  if (big) {
    const px = Math.min(560, window.innerWidth - 32, window.innerHeight - 140);
    return (
      <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-stone-950/40 px-4">
        <div className="glass pointer-events-auto p-3 text-stone-100">
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <b>{label}</b>
            <button className="rounded-xs px-2 py-0.5 text-xs ring-1 ring-stone-100/30" onClick={() => setBig(false)}>
              M · close
            </button>
          </div>
          <MapView sim={sim} floor={floor} px={px} big />
        </div>
      </div>
    );
  }
  return (
    <button
      className="glass pointer-events-auto absolute top-4 right-4 p-2 text-left text-stone-100"
      onClick={() => setBig(true)}
      aria-label="Open the map"
    >
      <MapView sim={sim} floor={floor} px={188} big={false} />
      <div className="mt-1 flex justify-between text-[10px] text-stone-300">
        <span className="label-mono">{label}</span>
        <span className="text-stone-400">M · bigger</span>
      </div>
    </button>
  );
}
