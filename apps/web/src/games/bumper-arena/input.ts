// One input state for the player's ring, fed by the keyboard and the touch controls. The
// game loop reads it every step; `dashPressed` is cleared once a step has used it.
import { useEffect } from "react";

export const input = { x: 0, y: 0, dashPressed: false, brace: false };

/** The touch stick's axes (screen up = +y), merged with the keys. */
const stick = { x: 0, y: 0 };
const keys = new Set<string>();
let touchBrace = false;

function refresh() {
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const up = keys.has("ArrowUp") || keys.has("KeyW");
  const down = keys.has("ArrowDown") || keys.has("KeyS");
  input.x = Math.max(-1, Math.min(1, (right ? 1 : 0) - (left ? 1 : 0) + stick.x));
  input.y = Math.max(-1, Math.min(1, (up ? 1 : 0) - (down ? 1 : 0) + stick.y));
  input.brace = touchBrace || keys.has("ShiftLeft") || keys.has("ShiftRight");
}

export function setStick(x: number, y: number) {
  stick.x = x;
  stick.y = y;
  refresh();
}

export function pressDash() {
  input.dashPressed = true;
}

export function holdBrace(down: boolean) {
  touchBrace = down;
  refresh();
}

const CONTROL_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"]);

/** Keyboard controls while `active`. Arrow keys and Space don't scroll the page meanwhile. */
export function useKeyboard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (!CONTROL_KEYS.has(e.code)) return;
      e.preventDefault();
      if (e.code === "Space") {
        if (!e.repeat) pressDash();
      } else keys.add(e.code);
      refresh();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code);
      refresh();
    };
    const blur = () => {
      keys.clear();
      touchBrace = false;
      stick.x = stick.y = 0;
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
