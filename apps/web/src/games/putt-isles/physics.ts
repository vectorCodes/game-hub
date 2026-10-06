// The ball's physics: a Rapier world (the deterministic build, so a shot plays out the same
// on every device) with the course as two triangle meshes, walls bouncier than the green.
// Steps at a fixed rate; the scene draws between steps.
import RAPIER, { type Collider, type RigidBody, type World } from "@dimforge/rapier3d-deterministic-compat";
import { BALL_RADIUS, CUP, PHYSICS } from "./config";
import type { Vec3 } from "./course";

type Rapier = typeof RAPIER;

let loading: Promise<Rapier> | null = null;

/** Rapier is WebAssembly: loaded once, only when a course is opened. */
export function loadRapier(): Promise<Rapier> {
  return (loading ??= RAPIER.init().then(() => RAPIER));
}

export interface CollisionMesh {
  vertices: Float32Array;
  indices: Uint32Array;
}

export interface CourseCollision {
  floor: CollisionMesh;
  walls: CollisionMesh;
  /** The lowest green on the hole: falling well below it is out of bounds. */
  floorY: number;
}

export type PuttEvent =
  | { type: "shot"; power: number }
  /** Hit a wall (or obstacle); `speed` is how hard, in m/s. */
  | { type: "wall"; speed: number }
  | { type: "sink" }
  | { type: "out" }
  | { type: "rest" };

export type BallState = "rest" | "rolling" | "sunk" | "out";

/** The aim preview: from the ball to the first wall (if it's in reach), then the bounce. */
export interface AimPath {
  points: Vec3[];
  /** Total length drawn. */
  length: number;
}

function trimesh(R: Rapier, mesh: CollisionMesh) {
  // Smooths contacts over the edges between triangles, so the ball doesn't catch on the
  // seams between tiles. Falls back to a plain mesh if the topology doesn't allow it.
  try {
    return R.ColliderDesc.trimesh(mesh.vertices, mesh.indices, R.TriMeshFlags.FIX_INTERNAL_EDGES);
  } catch {
    return R.ColliderDesc.trimesh(mesh.vertices, mesh.indices);
  }
}

export class PuttWorld {
  readonly world: World;
  readonly ball: RigidBody;
  private readonly walls: Collider;
  private readonly killY: number;
  state: BallState = "rest";
  /** Where the ball was last at rest: shots are taken from here, and out-of-bounds returns here. */
  readonly lastRest: Vec3;
  /** Ball position at the previous and the current step, for drawing in between. */
  readonly prev: Vec3;
  readonly pos: Vec3;
  tick = 0;
  events: PuttEvent[] = [];
  private still = 0;
  private rolled = 0;
  private wallCooldown = 0;
  /** Freed worlds ignore calls: a frame can still land between a hole change and the redraw. */
  private freed = false;

  constructor(
    private readonly R: Rapier,
    course: CourseCollision,
    tee: Vec3,
    readonly cup: Vec3,
  ) {
    const world = new R.World({ x: 0, y: -PHYSICS.gravity, z: 0 });
    world.timestep = PHYSICS.tick;
    this.world = world;

    const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
    world.createCollider(
      trimesh(R, course.floor)
        .setFriction(0)
        .setRestitution(PHYSICS.floorRestitution)
        .setRestitutionCombineRule(R.CoefficientCombineRule.Max),
      ground,
    );
    this.walls = world.createCollider(
      trimesh(R, course.walls)
        .setFriction(0)
        .setRestitution(PHYSICS.wallRestitution)
        .setRestitutionCombineRule(R.CoefficientCombineRule.Max),
      ground,
    );

    const start = { x: tee.x, y: tee.y + BALL_RADIUS, z: tee.z };
    this.ball = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(start.x, start.y, start.z)
        .setLinearDamping(PHYSICS.linearDamping)
        // Contacts are frictionless and the ball never turns in the physics: rolling is
        // modelled below, and the spin is drawn from the speed.
        .lockRotations()
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    world.createCollider(R.ColliderDesc.ball(BALL_RADIUS).setFriction(0).setRestitution(0).setDensity(1100), this.ball);
    // At rest the ball is switched off: nothing nudges it until the next shot.
    this.ball.setEnabled(false);
    this.killY = course.floorY - PHYSICS.killDepth;
    this.lastRest = { ...start };
    this.prev = { ...start };
    this.pos = { ...start };
  }

  /** Hits the ball towards `yaw` (0 = +z) with `power` 0–1. */
  shoot(yaw: number, power: number) {
    if (this.freed || this.state !== "rest") return;
    const speed = PHYSICS.maxSpeed * Math.pow(Math.min(1, Math.max(0, power)), PHYSICS.powerCurve);
    const vx = Math.sin(yaw) * speed;
    const vz = Math.cos(yaw) * speed;
    this.ball.setEnabled(true);
    this.ball.setLinvel({ x: vx, y: 0, z: vz }, true);
    this.state = "rolling";
    this.still = 0;
    this.rolled = 0;
    this.events.push({ type: "shot", power });
  }

  /** Puts the ball at rest at `p` (on the green): the tee, or back after going out. */
  place(p: Vec3) {
    if (this.freed) return;
    this.ball.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ball.setEnabled(false);
    Object.assign(this.lastRest, p);
    Object.assign(this.prev, p);
    Object.assign(this.pos, p);
    this.state = "rest";
  }

  step() {
    if (this.freed) return;
    Object.assign(this.prev, this.pos);
    if (this.state !== "rolling") {
      this.world.step();
      this.tick++;
      return;
    }
    const before = this.ball.linvel();
    this.world.step();
    this.tick++;
    const v = this.ball.linvel();
    const p = this.ball.translation();
    Object.assign(this.pos, p);

    // Rolling resistance: a steady slowing, on top of the damping.
    const flat = Math.hypot(v.x, v.z);
    if (flat > 1e-6) {
      const k = Math.max(0, flat - PHYSICS.rollingResistance * PHYSICS.tick) / flat;
      v.x *= k;
      v.z *= k;
      this.ball.setLinvel(v, true);
    }

    // A sharp change in the ball's direction along the ground is a wall.
    this.wallCooldown = Math.max(0, this.wallCooldown - 1);
    const dv = Math.hypot(v.x - before.x, v.z - before.z);
    if (dv > 0.3 && this.wallCooldown === 0) {
      this.events.push({ type: "wall", speed: dv });
      this.wallCooldown = 6;
    }

    if (p.y < this.killY) {
      this.state = "out";
      this.ball.setEnabled(false);
      this.events.push({ type: "out" });
      return;
    }

    const speed = Math.hypot(v.x, v.y, v.z);
    const toCup = Math.hypot(p.x - this.cup.x, p.z - this.cup.z);
    if (toCup < CUP.captureRadius && speed < CUP.maxSpeed && p.y < this.cup.y + BALL_RADIUS + 0.02) {
      this.state = "sunk";
      this.ball.setEnabled(false);
      this.events.push({ type: "sink" });
      return;
    }

    this.still = speed < PHYSICS.stopSpeed ? this.still + PHYSICS.tick : 0;
    this.rolled += PHYSICS.tick;
    if (this.still >= PHYSICS.stopTime || this.rolled >= PHYSICS.maxRollTime) {
      this.place({ x: p.x, y: p.y, z: p.z });
      this.events.push({ type: "rest" });
    }
  }

  /** The aim line for a shot towards `yaw`, `length` long: straight to the first wall, then the bounce. */
  aimPath(yaw: number, length: number): AimPath {
    const R = this.R;
    const o = this.lastRest;
    if (this.freed) return { points: [{ ...o }], length: 0 };
    const dir = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
    const points: Vec3[] = [{ ...o }];
    const walls = this.walls;
    const hit = this.world.castRayAndGetNormal(
      new R.Ray(o, dir),
      length,
      true,
      undefined,
      undefined,
      undefined,
      this.ball,
      (c) => c.handle === walls.handle,
    );
    // Stop the line a ball's radius short of the wall: that's where the ball touches it.
    const reach = hit ? Math.max(0, hit.timeOfImpact - BALL_RADIUS) : length;
    const first = { x: o.x + dir.x * reach, y: o.y, z: o.z + dir.z * reach };
    points.push(first);
    if (hit && reach < length) {
      const n = hit.normal;
      const nl = Math.hypot(n.x, n.z) || 1;
      const nx = n.x / nl;
      const nz = n.z / nl;
      const d = dir.x * nx + dir.z * nz;
      const rx = dir.x - 2 * d * nx;
      const rz = dir.z - 2 * d * nz;
      const rest = Math.min(length - reach, 0.6);
      points.push({ x: first.x + rx * rest, y: o.y, z: first.z + rz * rest });
      return { points, length: reach + rest };
    }
    return { points, length: reach };
  }

  dispose() {
    if (this.freed) return;
    this.freed = true;
    this.world.free();
  }
}
