// The prototype's HUD: the countdown, round clock and rings left, the kill feed, your Wobble
// and cooldowns, the touch controls, and the round-over card with the bot setup.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BUMPER_MAPS, type BotLevel } from "@shadow/shared";
import { useSound } from "../../../lib/sound";
import { holdBrace, pressDash, setStick } from "../input";
import { ME, useBumper } from "../store";

const SUDDEN_DEATH = BUMPER_MAPS["picnic-plate"].suddenDeath.at;

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 rounded-xs bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-950">{children}</kbd>;
}

function clock(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function TopBar() {
  const phase = useBumper((s) => s.phase);
  const t = useBumper((s) => s.t);
  const alive = useBumper((s) => s.alive);
  const total = useBumper((s) => s.entrants.length);
  const warning = useBumper((s) => s.edgeWarning);
  const sudden = phase === "play" && t >= SUDDEN_DEATH;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4 sm:top-4">
      <div className="glass flex items-center gap-3 px-4 py-2 text-sm text-stone-100">
        <span className={`font-mono tabular-nums ${sudden ? "text-ember-300" : ""}`}>{clock(Math.max(0, t))}</span>
        {sudden && <span className={`label-mono ${warning ? "text-ember-300" : "text-stone-400"}`}>Sudden death</span>}
        <span className="h-4 w-px bg-stone-100/20" />
        <span>
          <span className="font-mono tabular-nums">{alive}</span>
          <span className="text-stone-400"> / {total} left</span>
        </span>
      </div>
    </div>
  );
}

function Countdown() {
  const phase = useBumper((s) => s.phase);
  const t = useBumper((s) => s.t);
  const [go, setGo] = useState(false);
  const was = useRef(phase);
  useEffect(() => {
    if (was.current === "countdown" && phase === "play") {
      setGo(true);
      const id = setTimeout(() => setGo(false), 700);
      return () => clearTimeout(id);
    }
    was.current = phase;
  }, [phase]);
  const text = phase === "countdown" ? String(Math.ceil(-t) || 1) : go ? "Bump!" : null;
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div key={text} className="animate-pop font-display text-7xl font-bold text-ink [text-shadow:0_3px_0_rgba(255,255,255,0.7)] sm:text-8xl">
        {text}
      </div>
    </div>
  );
}

function Feed() {
  const feed = useBumper((s) => s.feed);
  return (
    <div className="pointer-events-none absolute top-28 right-4 flex flex-col items-end gap-1.5 sm:top-16">
      {feed.map((f) => (
        <div key={f.id} className="glass animate-rise px-3 py-1.5 text-xs text-stone-100">
          {f.text}
        </div>
      ))}
    </div>
  );
}

/** A cooldown ring around a control: fills as it comes back. */
function Ready({ value, children, className = "" }: { value: number; children: ReactNode; className?: string }) {
  return (
    <span className={`relative grid place-items-center rounded-full ${className}`} style={{ background: `conic-gradient(var(--color-gold) ${value * 360}deg, rgb(42 34 22 / 0.15) 0deg)` }}>
      <span className="absolute inset-[3px] rounded-full bg-[var(--glass)]" />
      <span className="relative">{children}</span>
    </span>
  );
}

function Status({ touch }: { touch: boolean }) {
  const wobble = useBumper((s) => s.wobble);
  const dash = useBumper((s) => s.dashReady);
  const brace = useBumper((s) => s.braceReady);
  const myState = useBumper((s) => s.myState);
  const phase = useBumper((s) => s.phase);
  if (myState !== "in" && phase === "play") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
        <div className="glass px-4 py-2 text-sm text-stone-100">You're out. Watch who wins.</div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute bottom-5 left-5 flex items-end gap-3">
      <div className="glass px-4 py-2 text-stone-100">
        <div className="label-mono text-stone-400">Wobble</div>
        <div className={`font-display text-3xl font-bold tabular-nums ${wobble >= 100 ? "text-ember-300" : ""}`}>{wobble}%</div>
      </div>
      {/* Tablets see their cooldowns on the touch buttons instead. */}
      <div className={`glass hidden items-center gap-3 px-4 py-3 text-xs text-stone-300 ${touch ? "" : "sm:flex"}`}>
        <Ready value={dash} className="h-11 w-11">
          <span className="font-mono text-[10px] font-semibold uppercase">Dash</span>
        </Ready>
        <Ready value={brace} className="h-11 w-11">
          <span className="font-mono text-[10px] font-semibold uppercase">Brace</span>
        </Ready>
        <span className="leading-6">
          <Kbd>WASD</Kbd> drive · <Kbd>Space</Kbd> dash · <Kbd>Shift</Kbd> brace
        </span>
      </div>
    </div>
  );
}

/** Left thumb: a joystick. Right thumb: dash, and brace above it. Only on touch screens. */
function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const dash = useBumper((s) => s.dashReady);
  const brace = useBumper((s) => s.braceReady);
  const RADIUS = 44;

  const move = (e: React.PointerEvent) => {
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
    setStick(Math.abs(dx) < 6 ? 0 : dx / RADIUS, Math.abs(dy) < 6 ? 0 : -dy / RADIUS);
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    setStick(0, 0);
  };

  useEffect(
    () => () => {
      setStick(0, 0);
      holdBrace(false);
    },
    [],
  );

  return (
    <>
      <div
        ref={base}
        style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))", left: "calc(1.25rem + env(safe-area-inset-left))" }}
        className="absolute h-28 w-28 touch-none rounded-full bg-stone-950/10 ring-1 ring-stone-100/25 backdrop-blur-sm select-none sm:h-32 sm:w-32"
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
          className="absolute top-1/2 left-1/2 h-14 w-14 rounded-full bg-[#fffaf0]/90 shadow-lg ring-2 ring-[#fffaf0]/50"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
      <button
        aria-label="Brace"
        style={{ bottom: "calc(8.5rem + env(safe-area-inset-bottom))", right: "calc(1.5rem + env(safe-area-inset-right))" }}
        className="absolute touch-none select-none active:scale-95"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          holdBrace(true);
        }}
        onPointerUp={() => holdBrace(false)}
        onPointerCancel={() => holdBrace(false)}
      >
        <Ready value={brace} className="h-16 w-16 font-display text-sm font-bold text-ink">
          Brace
        </Ready>
      </button>
      <button
        aria-label="Dash"
        style={{ bottom: "calc(1.75rem + env(safe-area-inset-bottom))", right: "calc(1.75rem + env(safe-area-inset-right))" }}
        className="absolute touch-none select-none active:scale-95"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pressDash();
        }}
      >
        <Ready value={dash} className="h-24 w-24 font-display text-lg font-bold text-ink">
          Dash
        </Ready>
      </button>
    </>
  );
}

const LEVELS: BotLevel[] = ["easy", "normal", "hard"];

function RoundOver() {
  const winner = useBumper((s) => s.winner);
  const entrants = useBumper((s) => s.entrants);
  const wins = useBumper((s) => s.wins);
  const round = useBumper((s) => s.round);
  const bots = useBumper((s) => s.bots);
  const level = useBumper((s) => s.level);
  const { next, setBots, setLevel } = useBumper.getState();
  const name = entrants.find((e) => e.id === winner)?.name;
  const title = winner === ME ? "You win!" : name ? `${name} wins` : "Draw";
  const table = [...entrants].sort((a, b) => (wins[b.id] ?? 0) - (wins[a.id] ?? 0));

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-stone-950/10 p-4">
      <div className="glass w-full max-w-sm animate-pop p-6 text-stone-100">
        <div className="label-mono text-stone-400">Round {round}</div>
        <h2 className="mt-1 font-display text-4xl">{title}</h2>
        <ul className="mt-4 divide-y divide-stone-100/10 text-sm">
          {table.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: e.color }} />
              <span className={e.id === ME ? "font-semibold" : ""}>{e.name}</span>
              <span className="ml-auto font-mono tabular-nums text-stone-400">{wins[e.id] ?? 0}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="label-mono text-stone-400">Bots</span>
            <span className="flex items-center gap-2">
              <button className="surface h-9 w-9" onClick={() => setBots(Math.max(1, bots - 1))} aria-label="Fewer bots">
                −
              </button>
              <span className="w-4 text-center font-mono tabular-nums">{bots}</span>
              <button className="surface h-9 w-9" onClick={() => setBots(Math.min(7, bots + 1))} aria-label="More bots">
                +
              </button>
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-mono text-stone-400">Level</span>
            <select className="surface h-9 px-2 capitalize" value={level} onChange={(e) => setLevel(e.target.value as BotLevel)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn-primary mt-5 h-12 w-full rounded-xs font-mono text-sm font-semibold tracking-[0.12em] uppercase" onClick={next}>
          Next round
        </button>
        <p className="mt-2 hidden text-center text-xs text-stone-400 sm:block">
          or press <Kbd>Enter</Kbd>
        </p>
      </div>
    </div>
  );
}

function Corner() {
  const { muted, toggle } = useSound();
  const toggleTuning = useBumper((s) => s.toggleTuning);
  return (
    <div className="absolute top-4 left-4 flex gap-2 text-xs">
      <Link to="/" className="glass px-3 py-2 text-stone-100">
        ← Hub
      </Link>
      <button className="glass px-3 py-2 text-stone-100" onClick={toggle}>
        {muted ? "Sound off" : "Sound on"}
      </button>
      <button className="glass px-3 py-2 text-stone-100" onClick={toggleTuning}>
        Tuning <span className="hidden text-stone-400 sm:inline">(T)</span>
      </button>
    </div>
  );
}

export function Hud({ touch }: { touch: boolean }) {
  const phase = useBumper((s) => s.phase);
  // A beat after the last ring falls, so you see it go.
  const [showOver, setShowOver] = useState(false);
  useEffect(() => {
    if (phase !== "over") return setShowOver(false);
    const id = setTimeout(() => setShowOver(true), 1400);
    return () => clearTimeout(id);
  }, [phase]);

  return (
    <>
      <TopBar />
      <Corner />
      <Feed />
      <Countdown />
      {phase !== "over" && <Status touch={touch} />}
      {touch && phase !== "over" && <TouchControls />}
      {showOver && <RoundOver />}
    </>
  );
}
