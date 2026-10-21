// The sandbox HUD: where you are, a stopwatch for timing routes, the sprint and taunt meters,
// the crosshair with what E, Q, X and G do right now, the minimap, and the controls (H shows and hides them).
// On phones the prompts are buttons and the touch controls take the bottom corners.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { HUNT_TAUNT_COOLDOWN_MS } from "@shadow/shared";
import { actions } from "../input";
import { useHuntRoom } from "../room";
import { useHunt } from "../store";
import { Minimap } from "./Minimap";
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

/** The crosshair, and what E, Q, X and G do right now (on phones, buttons that do it). */
function PropPrompt({ sim, touch }: { sim: HuntSim; touch: boolean }) {
  const aimed = useHunt((s) => s.aimed);
  const disguise = useHunt((s) => s.disguise);
  const locked = useHunt((s) => s.locked);
  const { room, you } = useHuntRoom();
  const prop = aimed === null ? undefined : sim.map.props[aimed];
  const target = prop ? sim.map.kinds[prop.kind] : null;
  const self = disguise ? sim.map.kinds[disguise] : null;
  // In a match the room counts decoys; on your own they're endless (the last few stay).
  const playing = room && (room.status === "hide" || room.status === "seek");
  const decoys = playing ? (room.players.find((p) => p.id === you)?.decoys ?? 0) : null;
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
          {self && decoys !== 0 && <PromptButton onTap={() => (actions.decoy = true)}>Decoy{decoys !== null && ` (${decoys})`}</PromptButton>}
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
            <div className="mt-1 text-stone-300">
              {decoys === 0 ? (
                "No decoys left this round"
              ) : (
                <>
                  <Key>G</Key> leave a decoy here{decoys !== null && ` (${decoys} left)`}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </>
  );
}

type Group = "move" | "hide" | "seek" | "view";

/** Every control, short enough for a tile. In a match only the ones for your role show. */
const CONTROLS: { group: Group; key: string; what: string }[] = [
  { group: "move", key: "WASD", what: "Move" },
  { group: "move", key: "Space", what: "Jump" },
  { group: "move", key: "Shift", what: "Sprint" },
  { group: "move", key: "Click", what: "Mouse look" },
  { group: "hide", key: "E", what: "Become prop" },
  { group: "hide", key: "Q", what: "Lock turn" },
  { group: "hide", key: "X", what: "Be yourself" },
  { group: "hide", key: "F", what: "Taunt" },
  { group: "hide", key: "G", what: "Decoy" },
  { group: "seek", key: "V", what: "Scan" },
  { group: "seek", key: "R", what: "Sonar" },
  { group: "view", key: "M", what: "Big map" },
  { group: "view", key: "Scroll", what: "Zoom" },
  { group: "view", key: "←→↑↓", what: "Camera" },
  { group: "view", key: "T", what: "Stopwatch" },
  { group: "view", key: "Tab", what: "Overview" },
];

const GROUPS: { id: Group; name: string; dot: string }[] = [
  { id: "move", name: "Move", dot: "bg-stone-300" },
  { id: "hide", name: "Hide", dot: "bg-lamp-300" },
  { id: "seek", name: "Seek", dot: "bg-ember-300" },
  { id: "view", name: "View", dot: "bg-[#7ec8ff]" },
];

const OPEN_KEY = "propHunt.controls";
function savedOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== "closed";
  } catch {
    return true;
  }
}

/** Right, under the minimap: the controls as grouped key tiles. H toggles them. */
function Controls() {
  const [open, setOpen] = useState(savedOpen);
  const { room, you } = useHuntRoom();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== "KeyH" || e.repeat) return;
      setOpen((o) => {
        try {
          localStorage.setItem(OPEN_KEY, o ? "closed" : "open");
        } catch {
          // Not remembered this time.
        }
        return !o;
      });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  if (!open)
    return (
      <div className="glass pointer-events-none absolute top-60 right-4 hidden px-3 py-2 text-xs text-stone-300 sm:block">
        <Key>H</Key> controls
      </div>
    );

  // In a match: just your role's keys (and none of the sandbox-only ones).
  const role = room && room.status !== "lobby" ? room.players.find((p) => p.id === you)?.role : undefined;
  const groups = GROUPS.filter((g) => (role === "hider" ? g.id !== "seek" : role === "seeker" ? g.id !== "hide" : true));
  const shown = (c: (typeof CONTROLS)[number]) => !(role && c.key === "Tab");

  return (
    <div className="glass pointer-events-none absolute top-60 right-4 hidden w-60 p-3 text-stone-100 sm:block">
      {groups.map((g) => (
        <section key={g.id} className="mb-2.5 last:mb-0">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-stone-400 uppercase">
            <span className={`size-1.5 rounded-full ${g.dot}`} />
            {g.name}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {CONTROLS.filter((c) => c.group === g.id && shown(c)).map((c) => (
              <div key={c.key} className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-1.5 py-1 ring-1 ring-white/[0.06]">
                <kbd className="min-w-6 shrink-0 rounded-md border-b-2 border-stone-400 bg-stone-100 px-1 text-center font-mono text-[10px] leading-4 font-semibold text-stone-950">
                  {c.key}
                </kbd>
                <span className="truncate text-[11px] text-stone-200">{c.what}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="mt-2 text-right text-[10px] text-stone-500">
        <Key>H</Key> hide
      </div>
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
      <PropPrompt sim={sim} touch={touch} />
      <Minimap sim={sim} touch={touch} />
      {!touch && <Controls />}
    </>
  );
}
