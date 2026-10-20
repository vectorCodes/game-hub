// A taunt you can see as well as hear: musical notes float up from whoever made it.
import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { HUNT_TAUNTS } from "@shadow/shared";
import type { HuntSim, SimEvent } from "../sim";

const NOTES = ["♪", "♫", "♩", "♬"];
const COLORS = ["#f5c04a", "#e8774f", "#7ec8ff", "#d9a6ff"];

/** Floats a handful of notes up out of `el` (a zero-size box anchored in the world). */
export function burstNotes(el: HTMLElement, taunt: string) {
  // Each taunt sound starts the notes and colours in its own place.
  const sound = Math.max(0, HUNT_TAUNTS.findIndex((t) => t.id === taunt));
  for (let i = 0; i < 5; i++) {
    const note = document.createElement("span");
    note.textContent = NOTES[(i + sound) % NOTES.length];
    note.style.cssText = `position:absolute;left:0;top:0;font-size:${22 + Math.random() * 12}px;font-weight:700;color:${COLORS[(i + sound) % COLORS.length]};text-shadow:0 2px 6px rgba(0,0,0,.35);pointer-events:none;opacity:0`;
    el.appendChild(note);
    const dx = (Math.random() - 0.5) * 120;
    const anim = note.animate(
      [
        { transform: "translate(-50%, 0) scale(0.6)", opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.4}px), -30px) scale(1.1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(calc(-50% + ${dx}px), -110px) scale(0.9)`, opacity: 0 },
      ],
      { duration: 1300, delay: i * 90, easing: "ease-out", fill: "both" },
    );
    anim.onfinish = () => note.remove();
  }
}

/** The anchor notes float out of: put it inside a group that follows a player. */
export function NoteAnchor({ box }: { box: RefObject<HTMLDivElement | null> }) {
  return (
    <Html center zIndexRange={[20, 0]}>
      <div ref={box} className="pointer-events-none relative h-0 w-0" />
    </Html>
  );
}

/** Your own taunts' notes. */
export function TauntNotes({ sim, subscribe }: { sim: HuntSim; subscribe: (l: (e: SimEvent) => void) => () => void }) {
  const root = useRef<Group>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribe((e) => {
        if (e.type === "taunt" && box.current) burstNotes(box.current, e.sound);
      }),
    [subscribe],
  );

  useFrame(() => {
    const pl = sim.player;
    root.current?.position.set(pl.x, pl.y + sim.height + 0.2, pl.z);
  });

  return (
    <group ref={root}>
      <NoteAnchor box={box} />
    </group>
  );
}
