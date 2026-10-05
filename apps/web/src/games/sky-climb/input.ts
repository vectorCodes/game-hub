// One input state shared by the keyboard, the on-screen joystick and the jump button.
// The simulation reads it every frame.
import { useEffect } from "react";
import type { Input } from "./sim";

export const input: Input = { x: 0, y: 0, jumpHeld: false, jumpPressed: false };

/** The touch joystick's own axes, merged with the keys. */
export const stick = { x: 0, y: 0 };

const keys = new Set<string>();

function refresh() {
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const up = keys.has("ArrowUp") || keys.has("KeyW");
  const down = keys.has("ArrowDown") || keys.has("KeyS");
  input.x = Math.max(-1, Math.min(1, (right ? 1 : 0) - (left ? 1 : 0) + stick.x));
  input.y = Math.max(-1, Math.min(1, (up ? 1 : 0) - (down ? 1 : 0) + stick.y));
}

export function setStick(x: number, y: number) {
  stick.x = x;
  stick.y = y;
  refresh();
}

export function pressJump(down: boolean) {
  if (down && !input.jumpHeld) input.jumpPressed = true;
  input.jumpHeld = down;
}

const CONTROL_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD", "Space"]);

/** Keyboard controls while `active`. Arrow keys and Space don't scroll the page meanwhile. */
export function useKeyboard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
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
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      blur();
    };
  }, [active]);
}
