// The sandbox HUD: where you are, a stopwatch for timing routes, the sprint and taunt meters,
// the crosshair with what E, Q and X do right now, and the controls (H shows and hides them).
// On phones the prompts are buttons and the touch controls take the bottom corners.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BIG_HOUSE, HUNT_TAUNT_COOLDOWN_MS } from "@shadow/shared";
import { actions } from "../input";
import { useHunt } from "../store";
import { TouchControls } from "./Touch";
import type { HuntSim } from "../sim";

function Key({ children }: { children: ReactNode }) {
  return <kbd className="mx-0.5 rounded-xs bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-950">{children}</kbd>;
}

/** Runs `tick` every animation frame while mounted (for values that change every frame). */
function useEveryFrame(tick: () => void) {
  const ref = useRef(tick);
  useLayoutEffect(() => {
    ref.current = tick;
  });
  useEffect(() => {
    let id = 0;
    const loop = () => {
      ref.current();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

const formatWatch = (ms: number) => {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

/** Top centre: the room you're in, and the stopwatch (T, or a tap on phones, starts, stops, and starts again from zero). */
function WhereAndWatch({ touch }: { touch: boolean }) {
  const area = useHunt((s) => s.area);
  const level = useHunt((s) => s.level);
  const [watch, setWatch] = useState<{ start: number; stop: number | null } | null>(null);
  const text = useRef<HTMLSpanElement>(null);

  const toggle = () => setWatch((w) => (w && w.stop === null ? { ...w, stop: performance.now() } : { start: performance.now(), stop: null }));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyT" && !e.repeat) toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEveryFrame(() => {
    if (watch && text.current) text.current.textContent = formatWatch((watch.stop ?? performance.now()) - watch.start);
  });

  const face = watch ? (
    <span className={`font-mono tabular-nums ${watch.stop === null ? "text-lamp-500" : ""}`}>
      <span ref={text}>0:00.0</span>
    </span>
  ) : (
    <span className="text-stone-400">{touch ? "⏱ stopwatch" : <><Key>T</Key> stopwatch</>}</span>
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
      <div className="glass flex items-center gap-3 px-4 py-2 text-sm text-stone-100">
        <span>
          <b>{area ?? "Somewhere"}</b>
          <span className="ml-2 label-mono text-stone-400">{level}</span>
        </span>
        <span className="h-4 w-px bg-stone-100/20" />
        {touch ? (
          <button className="pointer-events-auto" onClick={toggle}>
            {face}
          </button>
        ) : (
          face
        )}
      </div>
    </div>
  );
}

/** Bottom left (top right on phones): the sprint bar and the taunt meter, read straight from the simulation. */
function Meters({ sim, touch }: { sim: HuntSim; touch: boolean }) {
  const sprint = useRef<HTMLDivElement>(null);
  const taunt = useRef<HTMLDivElement>(null);
  const tauntLabel = useRef<HTMLSpanElement>(null);

  useEveryFrame(() => {
    if (sprint.current) sprint.current.style.width = `${sim.player.stamina * 100}%`;
    const charge = sim.tauntCharge;
    if (taunt.current) taunt.current.style.width = `${charge * 100}%`;
    if (tauntLabel.current) tauntLabel.current.textContent = charge >= 1 ? "ready" : `${Math.ceil(((1 - charge) * HUNT_TAUNT_COOLDOWN_MS) / 1000)} s`;
  });

  return (
    <div className={`glass pointer-events-none absolute flex flex-col gap-2 px-4 py-3 text-xs text-stone-100 ${touch ? "top-16 right-4 w-36" : "bottom-6 left-4 w-48"}`}>
      <div>
        <div className="mb-1 flex justify-between">
          <span>{touch ? "Run" : <><Key>Shift</Key> Sprint</>}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-100/15">
          <div ref={sprint} className="h-full rounded-full bg-jade" />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between">
          <span>{touch ? "Taunt" : <><Key>F</Key> Taunt</>}</span>
          <span ref={tauntLabel} className="text-stone-400" />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-100/15">
          <div ref={taunt} className="h-full rounded-full bg-lamp-500" />
        </div>
      </div>
    </div>
  );
}

function PromptButton({ children, onTap }: { children: ReactNode; onTap: () => void }) {
  return (
    <button className="pointer-events-auto rounded-xs bg-stone-100 px-3 py-2 text-sm text-stone-950 active:scale-95" onClick={onTap}>
      {children}
    </button>
  );
}

/** The crosshair, and what E, Q and X do right now (on phones, buttons that do it). */
function PropPrompt({ touch }: { touch: boolean }) {
  const aimed = useHunt((s) => s.aimed);
  const disguise = useHunt((s) => s.disguise);
  const locked = useHunt((s) => s.locked);
  const target = aimed === null ? null : BIG_HOUSE.kinds[BIG_HOUSE.props[aimed].kind];
  const self = disguise ? BIG_HOUSE.kinds[disguise] : null;
  return (
    <>
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className={`block h-2 w-2 rounded-full ring-2 transition-colors ${target ? "bg-lamp-400 ring-lamp-400/40" : "bg-white/80 ring-black/30"}`} />
      </div>
      {touch ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-44 flex flex-wrap items-center justify-center gap-2 px-4">
          {target && target.id !== disguise && <PromptButton onTap={() => (actions.become = true)}>Become the {target.name.toLowerCase()}</PromptButton>}
          {self && <PromptButton onTap={() => (actions.lock = true)}>{locked ? "Unlock" : "Lock"}</PromptButton>}
          {self && <PromptButton onTap={() => (actions.unbecome = true)}>Be yourself</PromptButton>}
        </div>
      ) : (
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-4 text-center">
        {target && target.id !== disguise && (
          <div className="glass px-4 py-2 text-sm text-stone-100">
            <Key>E</Key> become the <b>{target.name.toLowerCase()}</b>
          </div>
        )}
        {self && (
          <div className="glass px-4 py-2 text-sm text-stone-100">
            You're a <b>{self.name.toLowerCase()}</b> · <Key>Q</Key> {locked ? "unlock rotation" : "lock rotation"} · <Key>X</Key> be yourself
            {locked && <span className="ml-2 label-mono text-lamp-500">Locked</span>}
          </div>
        )}
      </div>
      )}
    </>
  );
}

const CONTROLS: [string, string][] = [
  ["Click", "steer the camera with the mouse (Esc frees it)"],
  ["WASD", "move"],
  ["Space", "jump"],
  ["Shift", "sprint"],
  ["E", "become the prop you're looking at"],
  ["Q", "lock rotation"],
  ["X", "be yourself"],
  ["F", "taunt"],
  ["T", "stopwatch"],
  ["R", "next spawn (sonar, in a match)"],
  ["Scroll", "zoom"],
  ["Tab", "overview (not in a match)"],
  ["H", "hide this"],
];

/** Right: every control. H toggles it. */
function Controls() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "KeyH" && !e.repeat) setOpen((o) => !o);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!open)
    return (
      <div className="glass pointer-events-none absolute top-4 right-4 px-3 py-2 text-xs text-stone-100">
        <Key>H</Key> controls
      </div>
    );
  return (
    <div className="glass pointer-events-none absolute top-4 right-4 hidden w-60 p-4 text-xs text-stone-100 sm:block">
      <div className="mb-2 label-mono text-stone-400">Controls</div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
        {CONTROLS.map(([key, what]) => (
          <div key={key} className="contents">
            <dt>
              <Key>{key}</Key>
            </dt>
            <dd className="text-stone-300">{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Until the mouse is captured, a reminder that clicking the view gives it the camera. */
function MouseTip() {
  const [locked, setLocked] = useState(() => document.pointerLockElement !== null);
  useEffect(() => {
    const change = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", change);
    return () => document.removeEventListener("pointerlockchange", change);
  }, []);
  if (locked) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 hidden justify-center px-4 sm:flex">
      <div className="glass px-3 py-1.5 text-xs text-stone-100">Click the view to steer the camera with the mouse · it also follows you on its own</div>
    </div>
  );
}

export function Hud({ sim, touch }: { sim: HuntSim; touch: boolean }) {
  return (
    <>
      {touch && <TouchControls />}
      <WhereAndWatch touch={touch} />
      {!touch && <MouseTip />}
      <Meters sim={sim} touch={touch} />
      <PropPrompt touch={touch} />
      {!touch && <Controls />}
    </>
  );
}
