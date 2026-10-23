// The in-game HUD: the countdown, round clock and rings left (and the wave, in the Gauntlet),
// the kill feed, your Wobble and cooldowns, the tablet touch controls, the wave-cleared
// banner, and the cards at the end of a Practice round or a Gauntlet run. A party room's
// own cards (the lobby, round results) are in Party.tsx.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BUMPER_EMOTES, BUMPER_MAPS, BUMPER_MODIFIERS, PICKUP_NAMES, bumperWave, type BotLevel } from "@shadow/shared";
import { useAuth } from "../../../auth/store";
import { formatDuration } from "../../../lib/format";
import { useSound } from "../../../lib/sound";
import { EMOTES, emote } from "../emotes";
import { holdBrace, pressDash, setStick } from "../input";
import { ME, useBumper } from "../store";
import { Scores, useLeaveRoom } from "./Party";

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 rounded-xs bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-950">{children}</kbd>;
}

function clock(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The map being played. */
function useMap() {
  const map = useBumper((s) => s.map);
  return BUMPER_MAPS[map] ?? BUMPER_MAPS["picnic-plate"];
}

function TopBar() {
  const phase = useBumper((s) => s.phase);
  const t = useBumper((s) => s.t);
  const alive = useBumper((s) => s.alive);
  const total = useBumper((s) => s.entrants.length);
  const warning = useBumper((s) => s.edgeWarning);
  const wave = useBumper((s) => (s.mode === "gauntlet" ? s.gauntlet?.wave : null));
  const map = useMap();
  const sudden = phase === "play" && t >= map.suddenDeath.at;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
      <div className="glass flex items-center gap-3 px-4 py-2 text-sm text-stone-100">
        {wave && (
          <>
            <span className="font-display font-bold">Wave {wave}</span>
            <span className="h-4 w-px bg-stone-100/20" />
          </>
        )}
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
  const wave = useBumper((s) => (s.mode === "gauntlet" ? s.gauntlet?.wave : null));
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
      <div className="text-center">
        {wave && phase === "countdown" && <div className="font-display text-2xl font-bold text-ink [text-shadow:0_2px_0_rgba(255,255,255,0.7)]">Wave {wave}</div>}
        <div key={text} className="animate-pop font-display text-7xl font-bold text-ink [text-shadow:0_3px_0_rgba(255,255,255,0.7)] sm:text-8xl">
          {text}
        </div>
      </div>
    </div>
  );
}

function Feed() {
  const feed = useBumper((s) => s.feed);
  return (
    <div className="pointer-events-none absolute top-16 right-4 flex flex-col items-end gap-1.5">
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
  const mode = useBumper((s) => s.mode);
  const effect = useBumper((s) => s.effect);
  const effectLeft = useBumper((s) => s.effectLeft);
  if (myState !== "in" && phase === "play") {
    if (mode === "gauntlet") return null;
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
      {effect && (
        <div key={effect} className="glass animate-pop px-4 py-2 text-stone-100">
          <div className="label-mono text-stone-400">{effect === "shock" ? "Next dash" : "Pickup"}</div>
          <div className="font-display text-xl font-bold">
            {PICKUP_NAMES[effect]} <span className="font-mono text-sm text-stone-400 tabular-nums">{effectLeft}s</span>
          </div>
        </div>
      )}
      {/* Tablets see their cooldowns on the touch buttons instead. */}
      <div className={`glass hidden items-center gap-3 px-4 py-3 text-xs text-stone-300 ${touch ? "" : "sm:flex"}`}>
        <Ready value={dash} className="h-11 w-11">
          <span className="font-mono text-[10px] font-semibold uppercase">Dash</span>
        </Ready>
        <Ready value={brace} className="h-11 w-11">
          <span className="font-mono text-[10px] font-semibold uppercase">Brace</span>
        </Ready>
        <span className="leading-6">
          <Kbd>WASD</Kbd> drive · <Kbd>Space</Kbd> dash · <Kbd>Shift</Kbd> brace · <Kbd>1–4</Kbd> emotes
        </span>
      </div>
    </div>
  );
}

/** Tablets: a button that opens the four emotes. */
function EmoteButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute flex items-center gap-2" style={{ bottom: "calc(8.75rem + env(safe-area-inset-bottom))", right: "calc(6.5rem + env(safe-area-inset-right))" }}>
      {open &&
        BUMPER_EMOTES.map((e) => (
          <button
            key={e}
            aria-label={EMOTES[e].name}
            className="glass grid h-12 w-12 animate-pop place-items-center text-2xl active:scale-95"
            onPointerDown={() => {
              emote(e);
              setOpen(false);
            }}
          >
            {EMOTES[e].icon}
          </button>
        ))}
      <button aria-label="Emotes" className="glass grid h-12 w-12 place-items-center text-2xl active:scale-95" onPointerDown={() => setOpen((o) => !o)}>
        😀
      </button>
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

/** Practice settings: arena, how many bots, how good, pickups. */
export function PracticeSettings() {
  const practice = useBumper((s) => s.practice);
  const setPractice = useBumper((s) => s.setPractice);
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <label className="col-span-2 flex flex-col gap-1">
        <span className="label-mono text-stone-400">Arena</span>
        <select className="surface h-9 px-2" value={practice.map} onChange={(e) => setPractice({ map: e.target.value })}>
          {Object.values(BUMPER_MAPS).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1">
        <span className="label-mono text-stone-400">Bots</span>
        <span className="flex items-center gap-2">
          <button className="surface h-9 w-9" onClick={() => setPractice({ bots: Math.max(1, practice.bots - 1) })} aria-label="Fewer bots">
            −
          </button>
          <span className="w-4 text-center font-mono tabular-nums">{practice.bots}</span>
          <button className="surface h-9 w-9" onClick={() => setPractice({ bots: Math.min(7, practice.bots + 1) })} aria-label="More bots">
            +
          </button>
        </span>
      </div>
      <label className="flex flex-col gap-1">
        <span className="label-mono text-stone-400">Level</span>
        <select className="surface h-9 px-2 capitalize" value={practice.level} onChange={(e) => setPractice({ level: e.target.value as BotLevel })}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 flex items-center gap-2">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-gold)]" checked={practice.pickups} onChange={(e) => setPractice({ pickups: e.target.checked })} />
        <span>Pickups</span>
      </label>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-stone-950/10 p-4">
      <div className="glass w-full max-w-sm animate-pop p-6 text-stone-100">{children}</div>
    </div>
  );
}

function PracticeOver() {
  const winner = useBumper((s) => s.winner);
  const entrants = useBumper((s) => s.entrants);
  const wins = useBumper((s) => s.wins);
  const { next, openMenu } = useBumper.getState();
  const name = entrants.find((e) => e.id === winner)?.name;
  const title = winner === ME ? "You win!" : name ? `${name} wins` : "Draw";
  const table = [...entrants].sort((a, b) => (wins[b.id] ?? 0) - (wins[a.id] ?? 0));

  return (
    <Card>
      <div className="label-mono text-stone-400">Practice</div>
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
      <div className="mt-5">
        <PracticeSettings />
      </div>
      <button className="btn btn-primary mt-5 w-full" onClick={next}>
        Next round
      </button>
      <button className="btn btn-secondary mt-2 w-full" onClick={() => openMenu()}>
        Menu
      </button>
      <p className="mt-2 hidden text-center text-xs text-stone-400 sm:block">
        or press <Kbd>Enter</Kbd>
      </p>
    </Card>
  );
}

/** Between waves: a cheer and a look at what's next. */
function WaveCleared() {
  const g = useBumper((s) => s.gauntlet);
  if (!g || g.status !== "cleared") return null;
  const next = bumperWave(g.wave + 1);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center px-4">
      <div className="animate-pop rounded-xs bg-jade px-6 py-3 text-center text-rice shadow-[0_24px_60px_-24px_rgba(42,34,22,0.45)]">
        <div className="font-display text-3xl font-bold tracking-tight">Wave {g.wave} cleared!</div>
        <div className="mt-0.5 text-sm opacity-85">
          Next: {next.length} {next.length === 1 ? "bot" : "bots"}
          {next.includes("hard") ? ", some of them hard" : next.includes("normal") ? ", a bit sharper" : ""}
        </div>
      </div>
    </div>
  );
}

/** The day's run, ready to paste. */
export function shareText(number: number, map: string, modifier: string, waves: number, kos: number, peak: number) {
  const rings = "🛟".repeat(Math.min(waves, 12)) + (waves > 12 ? "+" : "");
  return [
    `Bumper Arena · Gauntlet #${number} · ${map}, ${modifier}`,
    `${rings}💥  ${waves} ${waves === 1 ? "wave" : "waves"}`,
    `${kos} KOs · peak wobble ${peak}%`,
    `${window.location.origin}/games/bumper-arena`,
  ].join("\n");
}

function GauntletOver() {
  const g = useBumper((s) => s.gauntlet);
  const { startGauntlet, openMenu } = useBumper.getState();
  const signedIn = useAuth((s) => !!s.user);
  const authEnabled = useAuth((s) => s.enabled);
  const signIn = useAuth((s) => s.signIn);
  const [copied, setCopied] = useState(false);
  const r = g?.result;
  if (!g || !r) return null;
  const map = BUMPER_MAPS[g.day.map]?.name ?? g.day.map;
  const modifier = BUMPER_MODIFIERS[g.day.modifier].name;
  const headline = r.waves === 0 ? "Bumped out!" : r.waves >= 8 ? "Unbudgeable!" : r.waves >= 5 ? "What a run!" : "Good run!";

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareText(g.day.number, map, modifier, r.waves, r.kos, r.peakWobble));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  };

  return (
    <Card>
      <div className="label-mono text-stone-400">
        Gauntlet #{g.day.number} · {map}, {modifier}
      </div>
      <h2 className="mt-1 font-display text-4xl">{headline}</h2>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["Waves", r.waves],
            ["KOs", r.kos],
            ["Points", r.score],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="surface px-2 py-3">
            <div className="font-display text-3xl font-bold tabular-nums">{value}</div>
            <div className="label-mono text-stone-400">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-stone-400">
        {formatDuration(r.seconds)} · peak wobble {r.peakWobble}%
      </p>
      <p className="mt-2 text-center text-sm">
        {r.replay
          ? "A practice run: only your first Gauntlet of the day counts."
          : r.saved === "saving"
            ? "Saving…"
            : r.rank
              ? `#${r.rank} of ${r.players} today`
              : r.saved === "local"
                ? "Kept in this browser."
                : null}
      </p>
      {!signedIn && authEnabled && !r.replay && (
        <button className="mt-2 w-full text-center text-sm text-lamp-500 underline-offset-4 hover:underline" onClick={() => void signIn()}>
          Sign in to put it on the leaderboard
        </button>
      )}
      <button className="btn btn-primary mt-5 w-full" onClick={share}>
        {copied ? "Copied!" : "Share"}
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn btn-secondary" onClick={startGauntlet}>
          Run again
        </button>
        <button className="btn btn-secondary" onClick={() => openMenu()}>
          Menu
        </button>
      </div>
      <Link to="/leaderboard?game=bumper-arena" className="mt-3 block text-center text-sm text-stone-400 hover:text-stone-100">
        Today's leaderboard →
      </Link>
    </Card>
  );
}

function Corner() {
  const { muted, toggle } = useSound();
  const toggleTuning = useBumper((s) => s.toggleTuning);
  const mode = useBumper((s) => s.mode);
  const backdrop = useBumper((s) => s.backdrop);
  const openMenu = useBumper((s) => s.openMenu);
  const leaveRoom = useLeaveRoom();
  return (
    <div className="absolute top-4 left-4 z-30 flex gap-2 text-xs">
      {backdrop ? (
        <Link to="/games/bumper-arena" className="glass px-3 py-2 text-stone-100">
          ← Back
        </Link>
      ) : mode === "party" ? (
        <button className="glass px-3 py-2 text-stone-100" onClick={leaveRoom}>
          ← Leave room
        </button>
      ) : (
        <button className="glass px-3 py-2 text-stone-100" onClick={() => openMenu()}>
          ← Menu
        </button>
      )}
      <button className="glass px-3 py-2 text-stone-100" onClick={toggle}>
        {muted ? "Sound off" : "Sound on"}
      </button>
      {import.meta.env.DEV && (
        <button className="glass px-3 py-2 text-stone-100" onClick={toggleTuning}>
          Tuning <span className="hidden text-stone-400 sm:inline">(T)</span>
        </button>
      )}
    </div>
  );
}

export function Hud({ touch }: { touch: boolean }) {
  const phase = useBumper((s) => s.phase);
  const mode = useBumper((s) => s.mode);
  const backdrop = useBumper((s) => s.backdrop);
  const gStatus = useBumper((s) => s.gauntlet?.status);
  // A beat after the last ring falls (or you do), so you see it go. A party's round card is the room's.
  const over = mode === "practice" ? phase === "over" : mode === "gauntlet" && gStatus === "out";
  const [showOver, setShowOver] = useState(false);
  useEffect(() => {
    if (!over) return setShowOver(false);
    const id = setTimeout(() => setShowOver(true), 1400);
    return () => clearTimeout(id);
  }, [over]);

  if (backdrop) return <Corner />;
  return (
    <>
      <TopBar />
      <Corner />
      {mode === "party" && <Scores />}
      <Feed />
      <Countdown />
      <WaveCleared />
      {!over && phase !== "over" && <Status touch={touch} />}
      {touch && !over && <TouchControls />}
      {touch && !over && <EmoteButton />}
      {showOver && (mode === "practice" ? <PracticeOver /> : mode === "gauntlet" ? <GauntletOver /> : null)}
    </>
  );
}
