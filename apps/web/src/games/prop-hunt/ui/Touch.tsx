// Phone controls: a joystick under the left thumb, and under the right one a pad to drag the
// camera round with, a big Jump button, and Sprint (hold) and Taunt beside it. Becoming a
// prop, locking and turning back are buttons in the prompt (see Hud).
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { actions, look, pressJump, setSprint, setStick } from "../input";

const RADIUS = 46;
/** Dragging a finger turns the camera a bit faster than a mouse would. */
const TOUCH_LOOK = 1.6;

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);

  const move = (e: ReactPointerEvent) => {
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
    // A small dead zone keeps a resting thumb from drifting.
    setStick(Math.abs(dx) < 6 ? 0 : dx / RADIUS, Math.abs(dy) < 6 ? 0 : -dy / RADIUS);
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    setStick(0, 0);
  };
  useEffect(() => () => setStick(0, 0), []);

  return (
    <div
      ref={base}
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))", left: "calc(1.25rem + env(safe-area-inset-left))" }}
      className="absolute z-10 h-32 w-32 touch-none rounded-full bg-stone-950/40 ring-1 ring-white/20 backdrop-blur-sm select-none"
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
  );
}

/** The right half of the screen: drag to turn the camera. */
function LookPad() {
  const last = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div
      className="absolute inset-y-0 right-0 w-1/2 touch-none"
      onPointerDown={(e) => {
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const l = last.current;
        if (!l || l.id !== e.pointerId) return;
        look.dx += (e.clientX - l.x) * TOUCH_LOOK;
        look.dy += (e.clientY - l.y) * TOUCH_LOOK;
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}

function RoundButton({ label, size, onDown, onUp, className = "", style }: { label: ReactNode; size: string; onDown: () => void; onUp?: () => void; className?: string; style?: CSSProperties }) {
  return (
    <button
      style={style}
      className={`absolute z-10 grid touch-none place-items-center rounded-full font-display font-bold select-none active:scale-95 ${size} ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {label}
    </button>
  );
}

export function TouchControls() {
  useEffect(() => () => {
    pressJump(false);
    setSprint(false);
  }, []);
  const right = "calc(1.5rem + env(safe-area-inset-right))";
  const bottom = (rem: number) => `calc(${rem}rem + env(safe-area-inset-bottom))`;
  return (
    <>
      <LookPad />
      <Joystick />
      <RoundButton
        label="Jump"
        size="h-20 w-20 text-lg"
        className="bg-gradient-to-b from-lamp-300 to-lamp-500 text-ink shadow-[0_0_30px_-6px_rgba(204,146,47,0.8)]"
        style={{ right, bottom: bottom(1.75) }}
        onDown={() => pressJump(true)}
        onUp={() => pressJump(false)}
      />
      <RoundButton
        label="Run"
        size="h-14 w-14 text-sm"
        className="bg-stone-950/55 text-white ring-1 ring-white/30 backdrop-blur-sm"
        style={{ right: `calc(${right} + 5.75rem)`, bottom: bottom(1.75) }}
        onDown={() => setSprint(true)}
        onUp={() => setSprint(false)}
      />
      <RoundButton
        label="♪"
        size="h-14 w-14 text-2xl"
        className="bg-stone-950/55 text-white ring-1 ring-white/30 backdrop-blur-sm"
        style={{ right, bottom: bottom(7.25) }}
        onDown={() => (actions.taunt = true)}
      />
    </>
  );
}
