// Ghosts: the climb is recorded GHOST_HZ times a second on its own play clock, sent with
// the finish, and replayed by others as a translucent climber. Guests keep their best
// ghost of today's tower in the browser instead.
import { GHOST_HZ, GHOST_MAX_FRAMES, type GhostFrame } from "@shadow/shared";
import { poseOf, type Sim } from "./sim";

/** Seconds of play in the current climb. Ghosts are recorded and replayed on this clock. */
export const playClock = { t: 0 };

const frames: GhostFrame[] = [];
let cheer = 0;

export function resetRecording() {
  playClock.t = 0;
  frames.length = 0;
  cheer = 0;
}

/** The checkpoint cheer, so ghosts celebrate too. */
export function recordCheer() {
  cheer = 1.1;
}

/** Advances the play clock and takes any frames that are due. */
export function record(dt: number, pl: Sim["player"]) {
  playClock.t += dt;
  cheer = Math.max(0, cheer - dt);
  while (frames.length < GHOST_MAX_FRAMES && frames.length <= playClock.t * GHOST_HZ) {
    frames.push(frameOf(pl, cheer > 0));
  }
}

export function frameOf(pl: Sim["player"], cheering = false): GhostFrame {
  return { x: pl.x, y: pl.y, z: pl.z, facing: pl.facing, pose: poseOf(pl, cheering) };
}

export const recordedFrames = () => frames;

/** Further than this between two frames is a respawn: jump there, don't glide. */
const TELEPORT = 3;

/** Shortest signed turn from `from` to `to`. */
export function angleDelta(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Blends two frames into `out` (k = 0 → a, 1 → b). */
export function blendFrames(a: GhostFrame, b: GhostFrame, k: number, out: GhostFrame) {
  if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > TELEPORT) k = k < 0.5 ? 0 : 1;
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  out.z = a.z + (b.z - a.z) * k;
  out.facing = a.facing + angleDelta(a.facing, b.facing) * k;
  out.pose = k < 0.5 ? a.pose : b.pose;
}

/** Where a ghost is `t` seconds into its climb. After its last frame it waits there. */
export function sampleGhost(track: GhostFrame[], t: number, out: GhostFrame) {
  if (!track.length) return;
  const f = Math.max(0, t * GHOST_HZ);
  const i = Math.floor(f);
  if (i >= track.length - 1) {
    const last = track[track.length - 1];
    Object.assign(out, last);
    if (last.pose !== "cheer") out.pose = "idle";
    return;
  }
  blendFrames(track[i], track[i + 1], f - i, out);
}

// ---------- This browser's best ghost of today's tower ----------

const LOCAL_KEY = "sky-climb:my-ghost";

export interface LocalGhost {
  seed: string;
  floor: number;
  seconds: number;
  ghost: string;
}

export function localGhost(seed: string): LocalGhost | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "null") as LocalGhost | null;
    return saved?.seed === seed ? saved : null;
  } catch {
    return null;
  }
}

/** Keeps a daily climb's ghost if it beats the one saved for that tower. */
export function keepLocalGhost(g: LocalGhost) {
  if (!g.seed.startsWith("daily-")) return;
  const old = localGhost(g.seed);
  if (old && (old.floor > g.floor || (old.floor === g.floor && old.seconds <= g.seconds))) return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(g));
  } catch {
    // Storage full or unavailable: no ghost next time.
  }
}

// ---------- Where everyone else is, for the HUD's height bar ----------

export type RiderKind = "me" | "ghost" | "challenge" | "live";

export interface RiderMark {
  id: string;
  name: string;
  kind: RiderKind;
  /** Fractional floor. */
  floor: number;
}

/** Updated every frame by the scene; the HUD reads it a few times a second. */
export const riderMarks = new Map<string, RiderMark>();
