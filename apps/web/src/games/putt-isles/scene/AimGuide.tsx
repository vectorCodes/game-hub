// While aiming: dots from the ball to the first wall and off it (longer with more power), and
// a gauge round the ball that fills green → yellow → red.
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, type InstancedMesh, type MeshBasicMaterial } from "three";
import { AIM, BALL_RADIUS } from "../config";
import { aim } from "../input";
import { usePutt } from "../store";
import { usePuttScene } from "./shared";

const DOTS = 40;
const DOT_GAP = 0.09;
const SEGMENTS = 40;
const GAUGE_RADIUS = BALL_RADIUS * 3.2;

const LOW = new Color("#8fe36a");
const MID = new Color("#f8cf72");
const HIGH = new Color("#ec5f4a");

/** Gauge colour at `t` (0–1). */
function powerColor(t: number, out: Color) {
  return t < 0.5 ? out.copy(LOW).lerp(MID, t * 2) : out.copy(MID).lerp(HIGH, (t - 0.5) * 2);
}

const dummy = new Object3D();
const color = new Color();

export function AimGuide() {
  const { world } = usePuttScene();
  const dots = useRef<InstancedMesh>(null);
  const gauge = useRef<InstancedMesh>(null);
  const fade = useRef(0);

  // The gauge's segments, coloured once along the sweep.
  useLayoutEffect(() => {
    const g = gauge.current;
    if (!g) return;
    for (let i = 0; i < SEGMENTS; i++) g.setColorAt(i, powerColor(i / (SEGMENTS - 1), color));
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
  }, []);

  const material = useMemo(() => ({ transparent: true, depthWrite: false, toneMapped: false }), []);

  useFrame((state, dt) => {
    const d = dots.current;
    const g = gauge.current;
    if (!d || !g) return;
    const on = aim.active && usePutt.getState().phase === "aim" && aim.power >= AIM.minPower;
    fade.current += ((on ? 1 : 0) - fade.current) * (1 - Math.exp(-dt * 18));
    d.visible = g.visible = fade.current > 0.02;
    if (!d.visible) return;

    const o = world.lastRest;
    const length = AIM.lineMin + (AIM.lineMax - AIM.lineMin) * aim.power;
    const path = world.aimPath(aim.yaw, length);

    // Dots along the path, marching outwards, smaller towards the end.
    const march = (state.clock.elapsedTime * 0.25) % DOT_GAP;
    let count = 0;
    let seg = 0;
    let segStart = 0;
    for (let s = DOT_GAP * 0.6 + march; s < path.length && count < DOTS; s += DOT_GAP) {
      while (seg < path.points.length - 2) {
        const a = path.points[seg];
        const b = path.points[seg + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (s - segStart <= len) break;
        segStart += len;
        seg++;
      }
      const a = path.points[seg];
      const b = path.points[seg + 1] ?? a;
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const k = Math.min(1, (s - segStart) / len);
      const shrink = 1 - (s / Math.max(path.length, 0.001)) * 0.55;
      dummy.position.set(a.x + (b.x - a.x) * k, o.y - BALL_RADIUS + 0.004, a.z + (b.z - a.z) * k);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(shrink * fade.current);
      dummy.updateMatrix();
      d.setMatrixAt(count++, dummy.matrix);
    }
    d.count = count;
    d.instanceMatrix.needsUpdate = true;
    (d.material as MeshBasicMaterial).color.copy(powerColor(aim.power, color));

    // The gauge: segments lit up to the power, starting behind the ball.
    const lit = Math.max(1, Math.round(aim.power * SEGMENTS));
    for (let i = 0; i < SEGMENTS; i++) {
      const t = aim.yaw + Math.PI + (i / SEGMENTS) * Math.PI * 2;
      dummy.position.set(o.x + Math.sin(t) * GAUGE_RADIUS, o.y - BALL_RADIUS + 0.005, o.z + Math.cos(t) * GAUGE_RADIUS);
      dummy.rotation.set(0, t, 0);
      dummy.scale.setScalar(i < lit ? fade.current : 0);
      dummy.updateMatrix();
      g.setMatrixAt(i, dummy.matrix);
    }
    g.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={dots} args={[undefined, undefined, DOTS]} frustumCulled={false} renderOrder={3}>
        <circleGeometry args={[0.02, 12]} />
        <meshBasicMaterial {...material} color="#ffffff" opacity={0.95} />
      </instancedMesh>
      <instancedMesh ref={gauge} args={[undefined, undefined, SEGMENTS]} frustumCulled={false} renderOrder={3}>
        <boxGeometry args={[0.013, 0.004, 0.016]} />
        <meshBasicMaterial {...material} opacity={0.95} />
      </instancedMesh>
    </>
  );
}
