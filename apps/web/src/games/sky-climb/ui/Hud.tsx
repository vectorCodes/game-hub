// What's laid over the climb: floor and zone, time, coins, a height bar with the zones
// (and where the ghosts and live climbers are), toasts (new zone, checkpoint, new best), the wind warning, and the touch controls.
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useSound } from "../../../lib/sound";
import { CHECKPOINTS, FLOORS, ZONES } from "../config";
import { riderMarks, type RiderKind, type RiderMark } from "../ghosts";
import { pressJump, setStick } from "../input";
import { nextCheckpointAfter } from "../sim";
import { useClimb } from "../store";

const ZONE_COLORS: Record<string, string> = {
  meadow: "#8fc76a",
  treetops: "#4fa86a",
  cliffs: "#e9a03a",
  snow: "#cfd6ff",
  storm: "#6d78a8",
  summit: "#f8cf72",
};

function Clock({ startedAt, endedAt }: { startedAt: number; endedAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (endedAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endedAt]);
  const s = Math.max(0, Math.floor(((endedAt ?? now) - startedAt) / 1000));
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-stone-950/70 px-3 py-1.5 text-sm font-medium text-stone-100 ring-1 ring-white/10 backdrop-blur-md ${className}`}>
      {children}
    </span>
  );
}

const MARK_COLORS: Record<RiderKind, string> = {
  me: "bg-lamp-300",
  ghost: "bg-sky-300",
  challenge: "bg-rose-400",
  live: "bg-moss-400",
};

/** Where the other climbers are, a few times a second. */
function useRiderMarks(): RiderMark[] {
  const [marks, setMarks] = useState<RiderMark[]>([]);
  useEffect(() => {
    const t = setInterval(() => setMarks([...riderMarks.values()]), 250);
    return () => clearInterval(t);
  }, []);
  return marks;
}

/** The whole tower as a thin bar: zones in colour, checkpoints as ticks, you as a dot. */
function HeightBar({ floor, best }: { floor: number; best: number }) {
  const marks = useRiderMarks();
  return (
    <div className="pointer-events-none absolute top-1/2 right-3 h-[52%] w-2 -translate-y-1/2 sm:right-5" aria-hidden>
      <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-white/15">
        {ZONES.slice(0, -1).map((z, i) => {
          const end = ZONES[i + 1].from;
          return (
            <div
              key={z.id}
              className="absolute inset-x-0 opacity-70"
              style={{ bottom: `${(z.from / FLOORS) * 100}%`, height: `${((end - z.from) / FLOORS) * 100}%`, background: ZONE_COLORS[z.id] }}
            />
          );
        })}
      </div>
      {CHECKPOINTS.slice(1, -1).map((c) => (
        <span key={c} className="absolute -left-0.5 h-px w-3 bg-white/60" style={{ bottom: `${(c / FLOORS) * 100}%` }} />
      ))}
      {best > 0 && (
        <span className="absolute -left-2 h-0.5 w-6 rounded bg-lamp-300" style={{ bottom: `${(best / FLOORS) * 100}%` }} title="Your best" />
      )}
      {marks.map((m) => (
        <span
          key={m.id}
          title={m.name}
          className="absolute right-full mr-1.5 flex translate-y-1/2 items-center gap-1 transition-[bottom] duration-300"
          style={{ bottom: `${(Math.min(m.floor, FLOORS) / FLOORS) * 100}%` }}
        >
          {m.kind === "challenge" && <span className="text-[10px] font-semibold whitespace-nowrap text-rose-200">{m.name}</span>}
          <span className={`h-2.5 w-2.5 rounded-full ring-1 ring-stone-950/60 ${MARK_COLORS[m.kind]}`} />
        </span>
      ))}
      <span
        className="absolute left-1/2 h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] ring-2 ring-lamp-400 transition-[bottom] duration-300"
        style={{ bottom: `${(floor / FLOORS) * 100}%` }}
      />
      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm">🏁</span>
    </div>
  );
}

function Toasts() {
  const toast = useClimb((s) => s.toast);
  if (!toast) return null;
  const tone =
    toast.tone === "best"
      ? "from-lamp-300/95 to-lamp-500/95 text-ink"
      : toast.tone === "checkpoint"
        ? "from-moss-400/90 to-moss-600/90 text-stone-950"
        : "from-stone-900/85 to-stone-950/85 text-stone-50";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[18%] flex justify-center px-4">
      <div key={toast.id} className={`animate-pop rounded-2xl bg-gradient-to-b px-6 py-3 text-center shadow-2xl ring-1 ring-white/15 backdrop-blur-md ${tone}`}>
        <div className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{toast.title}</div>
        {toast.subtitle && <div className="mt-0.5 text-sm opacity-80">{toast.subtitle}</div>}
      </div>
    </div>
  );
}

/** Left thumb: a joystick. Right thumb: jump. Only on touch screens. */
function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const RADIUS = 44;

  const move = (e: PointerEvent) => {
    const el = base.current;
    if (!el || pointer.current !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    // A small dead zone keeps resting thumbs from drifting.
    const nx = Math.abs(dx) < 6 ? 0 : dx / RADIUS;
    const ny = Math.abs(dy) < 6 ? 0 : -dy / RADIUS;
    setStick(nx, ny);
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    setStick(0, 0);
  };

  useEffect(() => () => setStick(0, 0), []);

  return (
    <>
      <div
        ref={base}
        className="absolute bottom-6 left-6 h-32 w-32 touch-none rounded-full bg-stone-950/40 ring-1 ring-white/20 backdrop-blur-sm select-none"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span
          className="absolute top-1/2 left-1/2 h-14 w-14 rounded-full bg-white/80 shadow-lg ring-2 ring-white/40"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
      <button
        aria-label="Jump"
        className="absolute right-8 bottom-8 grid h-24 w-24 touch-none place-items-center rounded-full bg-gradient-to-b from-lamp-300 to-lamp-500 font-display text-lg font-bold text-ink shadow-[0_0_30px_-6px_rgba(244,185,78,0.8)] select-none active:scale-95"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pressJump(true);
        }}
        onPointerUp={() => pressJump(false)}
        onPointerCancel={() => pressJump(false)}
      >
        Jump
      </button>
    </>
  );
}

export function Hud({ touch }: { touch: boolean }) {
  const floor = useClimb((s) => s.floor);
  const zone = ZONES[useClimb((s) => s.zone)];
  const coins = useClimb((s) => s.coins);
  const falls = useClimb((s) => s.falls);
  const startedAt = useClimb((s) => s.startedAt);
  const endedAt = useClimb((s) => s.endedAt);
  const best = useClimb((s) => s.previousBest);
  const windy = useClimb((s) => s.windy);
  const phase = useClimb((s) => s.phase);
  const finish = useClimb((s) => s.finish);
  const { muted, toggle } = useSound();
  const next = nextCheckpointAfter(floor);

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* A dip to dark on every fall, while the climber is put back. */}
      {falls > 0 && <div key={falls} aria-hidden className="absolute inset-0 animate-blackout bg-stone-950" />}

      <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
        <div className="rounded-2xl bg-stone-950/70 px-4 py-2.5 ring-1 ring-white/10 backdrop-blur-md">
          <div className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">Floor</div>
          <div className="font-display text-4xl leading-none font-bold tabular-nums">
            {floor}
            <span className="text-lg text-stone-500">/{FLOORS}</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip>
            {zone.emoji} {zone.name}
          </Chip>
          {floor < FLOORS && <Chip className="text-stone-300">🚩 Next checkpoint: {next}</Chip>}
        </div>
      </div>

      <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-2 sm:top-4 sm:right-4">
        <div className="flex gap-2">
          <Chip>⏱ {startedAt && <Clock startedAt={startedAt} endedAt={endedAt} />}</Chip>
          <Chip>🪙 {coins}</Chip>
          <Chip>
            💫 {falls}
            <span className="sr-only">falls</span>
          </Chip>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggle}
            aria-label={muted ? "Unmute" : "Mute"}
            className="grid h-9 w-9 place-items-center rounded-full bg-stone-950/70 text-sm ring-1 ring-white/10 backdrop-blur-md hover:bg-stone-900"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {phase === "playing" && (
            <button
              onClick={() => void finish()}
              className="rounded-full bg-stone-950/70 px-3.5 py-1.5 text-sm font-medium text-stone-200 ring-1 ring-white/10 backdrop-blur-md hover:bg-stone-900"
            >
              End climb
            </button>
          )}
        </div>
      </div>

      <HeightBar floor={floor} best={best} />
      <Toasts />

      {windy && (
        <div className="absolute inset-x-0 bottom-[22%] flex justify-center">
          <Chip className="animate-pulse text-base">💨 Wind! Hold on</Chip>
        </div>
      )}

      {phase === "playing" &&
        (touch ? (
          <div className="pointer-events-auto">
            <TouchControls />
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-4 flex justify-center">
            <Chip className="text-stone-300">
              <kbd className="font-sans">←→↑↓</kbd> / <kbd className="font-sans">WASD</kbd> move · <kbd className="font-sans">Space</kbd> jump
            </Chip>
          </div>
        ))}
    </div>
  );
}
