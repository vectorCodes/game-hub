// One input state for Prop Hunt, filled by the keyboard and mouse or by the touch controls.
// The simulation reads the movement; the camera reads and clears the look deltas.
import { useEffect } from "react";
import type { Input } from "./sim";

export const input: Input = { x: 0, y: 0, jumpHeld: false, jumpPressed: false, sprint: false };

/** Mouse movement since the camera last read it, and wheel zoom steps. */
export const look = { dx: 0, dy: 0, zoom: 0 };

/** One-shot actions, cleared by whoever handles them. */
export const actions = { respawn: false, become: false, unbecome: false, lock: false, taunt: false, zap: false, sonar: false };

/** Phones and tablets: touch controls instead of keys and a captured mouse. */
export const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

const keys = new Set<string>();
/** The touch joystick's axes and the sprint button, merged with the keys. */
const touch = { x: 0, y: 0, sprint: false };

function refresh() {
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const up = keys.has("ArrowUp") || keys.has("KeyW");
  const down = keys.has("ArrowDown") || keys.has("KeyS");
  input.x = Math.max(-1, Math.min(1, (right ? 1 : 0) - (left ? 1 : 0) + touch.x));
  input.y = Math.max(-1, Math.min(1, (up ? 1 : 0) - (down ? 1 : 0) + touch.y));
  input.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.sprint;
}

export function setStick(x: number, y: number) {
  touch.x = x;
  touch.y = y;
  refresh();
}

export function setSprint(on: boolean) {
  touch.sprint = on;
  refresh();
}

export function pressJump(down: boolean) {
  if (down && !input.jumpHeld) input.jumpPressed = true;
  input.jumpHeld = down;
}

const CONTROL_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"]);
/** Keys that fire once per press. */
const ACTION_KEYS: Record<string, keyof typeof actions> = { KeyR: "respawn", KeyE: "become", KeyX: "unbecome", KeyQ: "lock", KeyF: "taunt" };

/**
 * Keyboard and mouse while `active`. Clicking `target` locks the pointer, so the mouse turns
 * the camera without a button held; Esc gives it back (the browser does that).
 */
export function useControls(active: boolean, target: HTMLElement | null) {
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      const action = ACTION_KEYS[e.code];
      if (action) {
        e.preventDefault();
        if (!e.repeat) actions[action] = true;
        return;
      }
      if (!CONTROL_KEYS.has(e.code)) return;
      e.preventDefault();
      if (e.code === "Space") pressJump(true);
      else keys.add(e.code);
      refresh();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") pressJump(false);
      keys.delete(e.code);
      refresh();
    };
    const blur = () => {
      keys.clear();
      pressJump(false);
      refresh();
    };
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== target) return;
      look.dx += e.movementX;
      look.dy += e.movementY;
    };
    const wheel = (e: WheelEvent) => {
      look.zoom += Math.sign(e.deltaY);
    };
    // With the mouse captured, a click zaps (seekers; it does nothing for anyone else).
    const press = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement === target) actions.zap = true;
    };
    const lock = () => {
      if (isTouch() || document.pointerLockElement === target) return;
      // Some browsers return a promise that rejects if the lock is refused; that's fine.
      void Promise.resolve(target?.requestPointerLock?.()).catch(() => {});
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("mousemove", move);
    target?.addEventListener("wheel", wheel, { passive: true });
    target?.addEventListener("click", lock);
    target?.addEventListener("mousedown", press);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("mousemove", move);
      target?.removeEventListener("wheel", wheel);
      target?.removeEventListener("click", lock);
      target?.removeEventListener("mousedown", press);
      if (document.pointerLockElement === target) document.exitPointerLock();
      blur();
    };
  }, [active, target]);
}
