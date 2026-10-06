// Aiming and the camera's controls, shared between the pointer handlers and the scene's
// per-frame code (plain objects: read every frame, no re-renders).
import { useEffect } from "react";
import { AIM, CAMERA } from "./config";

/** The shot being lined up: drag back from anywhere, like a slingshot. */
export const aim = {
  active: false,
  pointer: -1,
  startX: 0,
  startY: 0,
  /** Heading of the shot (0 = +z) and its power, 0–1. */
  yaw: 0,
  power: 0,
};

/**
 * A shot that's been let go: the club swings through first, and the ball is struck a beat
 * later (`at`, in performance.now() time), when the putter meets it.
 */
export const strike = {
  pending: false,
  yaw: 0,
  power: 0,
  at: 0,
};

/** Seconds from letting go to the putter meeting the ball. */
export const STRIKE_DELAY = 0.1;

/** The camera: its heading, how far back it sits, and turning from keys or buttons (-1…1). */
export const view = {
  yaw: 0,
  distance: CAMERA.distance as number,
  turn: 0,
  /** Turning held on the touch buttons, so it adds to the keys rather than fighting them. */
  buttonTurn: 0,
};

/**
 * Turns a drag on screen into a shot. Pulling down sends the ball away from the camera,
 * pulling left sends it right: the ball goes opposite the pull, as seen on screen.
 */
export function updateAim(x: number, y: number, screen: { width: number; height: number }) {
  const sx = x - aim.startX;
  const sy = y - aim.startY;
  const len = Math.hypot(sx, sy);
  aim.power = Math.min(1, len / (AIM.fullPull * Math.min(screen.width, screen.height)));
  if (len < 2) return;
  const fx = Math.sin(view.yaw);
  const fz = Math.cos(view.yaw);
  // The camera's right, on the ground.
  const rx = -fz;
  const rz = fx;
  const dx = -sx * rx + sy * fx;
  const dz = -sx * rz + sy * fz;
  aim.yaw = Math.atan2(dx, dz);
}

export function cancelAim() {
  aim.active = false;
  aim.pointer = -1;
  aim.power = 0;
}

const KEYS: Record<string, number> = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };

/** A/D or ←/→ turn the camera; W/S or ↑/↓ move it in and out. */
export function useCameraKeys(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const held = new Set<string>();
    const sync = () => {
      view.turn = [...held].reduce((sum, k) => sum + (KEYS[k] ?? 0), 0);
    };
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code in KEYS) {
        held.add(e.code);
        sync();
        e.preventDefault();
      }
      if (e.code === "KeyW" || e.code === "ArrowUp") zoom(-0.35);
      if (e.code === "KeyS" || e.code === "ArrowDown") zoom(0.35);
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.code);
      sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      view.turn = 0;
    };
  }, [active]);
}

export function zoom(by: number) {
  view.distance = Math.min(CAMERA.maxDistance, Math.max(CAMERA.minDistance, view.distance + by));
}
