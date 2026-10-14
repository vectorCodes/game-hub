// One tile: drops in on the deal, lifts on hover, flips over on a spring with its pal popping
// up on the front, shakes on a wrong pair, and jumps, spins and glows on a match.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, Color, MathUtils, Vector3, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { palUrl, SPRING, TILE } from "../config";
import { usePairPop } from "../store";
import { backTexture, faceGeometry, faceTexture, tileGeometry } from "./art";
import { burst } from "./Burst";

/** A damped spring toward `target`; returns nothing, moves `s` along. */
interface Spring {
  x: number;
  v: number;
}
function step(s: Spring, target: number, dt: number, stiffness = SPRING.stiffness, damping = SPRING.damping) {
  s.v += ((target - s.x) * stiffness - s.v * damping) * dt;
  s.x += s.v * dt;
}

const smooth = (a: number, b: number, x: number) => MathUtils.smoothstep(x, a, b);
const HALF = TILE.thickness / 2;
const GOLD = new Color("#e2a940");
const BLACK = new Color("#000000");
const worldPos = new Vector3();

/** A pal model, sized to the tile and stood on its base. Clones share the cached materials. */
function Pal({ id }: { id: string }) {
  const { scene } = useGLTF(palUrl(id));
  const model = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o: Object3D) => {
      if ((o as Mesh).isMesh) o.castShadow = true;
    });
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const k = TILE.palSize / Math.max(size.x, size.y, size.z);
    root.scale.setScalar(k);
    const c = box.getCenter(new Vector3());
    root.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    return root;
  }, [scene]);
  return <primitive object={model} />;
}

interface Props {
  index: number;
  position: [number, number, number];
  /** Deal-in delay (s). */
  delay: number;
  /** Win wave delay (s), from the board's centre outward. */
  wave: number;
}

export function Tile({ index, position, delay, wave }: Props) {
  const card = usePairPop((s) => s.tiles[index]);
  const up = usePairPop((s) => s.up[index]);
  const matched = usePairPop((s) => s.matched[index]);
  const shakes = usePairPop((s) => s.shakes[index]);
  const done = usePairPop((s) => s.endedAt !== null);

  const root = useRef<Group>(null);
  const flipper = useRef<Group>(null);
  const pal = useRef<Group>(null);
  const body = useRef<MeshStandardMaterial>(null);
  const ring = useRef<Mesh>(null);
  const ringMat = useRef<MeshStandardMaterial>(null);

  const anim = useRef({
    born: -1,
    appear: { x: 0, v: 0 },
    flip: { x: 0, v: 0 },
    hover: { x: 0, v: 0 },
    pop: { x: 0, v: 0 },
    jump: { x: 0, v: 0 },
    spin: { x: 0, v: 0 },
    spinTarget: 0,
    glow: { x: 0, v: 0 },
    hovered: false,
    /** Where the tile is on the board; glides when the board turns with the screen. */
    x: position[0],
    z: position[2],
    /** Where the flip is headed, from when (performance.now, ms): the peek ripples across. */
    flipTarget: false,
    flipFrom: false,
    flipAt: 0,
    shakeT: 0,
    ringT: -1,
    waveAt: -1,
    spinDir: index % 2 ? 1 : -1,
  });
  const faceColor = useMemo(() => new Color(card.color), [card.color]);

  // Your flips turn at once; the peek's flips sweep over the board in the deal's order.
  useEffect(() => {
    const { phase, startedAt } = usePairPop.getState();
    const bulk = phase === "peek" || (phase === "play" && startedAt === null);
    if (anim.current.flipTarget === up) return;
    anim.current.flipFrom = anim.current.flipTarget;
    anim.current.flipTarget = up;
    anim.current.flipAt = performance.now() + (bulk ? delay * 600 : 0);
  }, [up, delay]);

  // A wrong pair: a quick no-no wobble.
  useEffect(() => {
    if (shakes) anim.current.shakeT = 0.5;
  }, [shakes]);

  // A match: hop, a full spin, a gold glow, a ring and confetti.
  useEffect(() => {
    if (!matched) return;
    const a = anim.current;
    a.jump.v = 5.5;
    a.spinTarget += Math.PI * 2 * a.spinDir;
    a.ringT = 0;
    root.current?.getWorldPosition(worldPos);
    burst(worldPos, card.color);
  }, [matched, card.color]);

  // The board is cleared: every pal hops in a wave from the middle.
  useEffect(() => {
    if (done) anim.current.waveAt = 0.45 + wave;
  }, [done, wave]);

  useEffect(
    () => () => {
      if (anim.current.hovered) document.body.style.cursor = "";
    },
    [],
  );

  useFrame(({ clock }, raw) => {
    const a = anim.current;
    const dt = Math.min(raw, 1 / 30);
    const t = clock.elapsedTime;
    if (a.born < 0) a.born = t;
    const age = t - a.born;

    step(a.appear, age > delay ? 1 : 0, dt, 120, 14);
    const turned = performance.now() >= a.flipAt ? a.flipTarget : a.flipFrom;
    step(a.flip, turned ? 1 : 0, dt);
    const flippable = !up && !matched && usePairPop.getState().phase === "play";
    step(a.hover, a.hovered && flippable ? 1 : 0, dt, 300, 22);
    // The pal pops up once the front is turning toward us, and ducks away fast going back.
    step(a.pop, turned && a.flip.x > 0.55 ? 1 : 0, dt, turned ? 260 : 500, turned ? 13 : 30);
    // Jumps are thrown with a velocity and fall back on a soft spring.
    step(a.jump, 0, dt, 90, 9);
    step(a.spin, a.spinTarget, dt, 60, 11);
    step(a.glow, matched ? 1 : 0, dt, 40, 10);

    if (a.waveAt >= 0 && done) {
      a.waveAt -= dt;
      if (a.waveAt < 0) {
        a.jump.v = 6.5;
        a.spinTarget += Math.PI * 2 * a.spinDir;
        a.waveAt = -1;
      }
    }

    const g = root.current;
    const f = flipper.current;
    const p = pal.current;
    if (!g || !f || !p) return;

    // Deal-in: drops from above with a twist.
    const ap = a.appear.x;
    const flip = MathUtils.clamp(a.flip.x, 0, 1);
    const arc = Math.sin(flip * Math.PI) * 0.6;
    const glide = 1 - Math.exp(-dt * 7);
    a.x += (position[0] - a.x) * glide;
    a.z += (position[2] - a.z) * glide;
    g.position.set(a.x, position[1] + Math.max(0, 1 - ap) * 5 + a.hover.x * 0.1 + arc, a.z);
    g.rotation.y = (1 - ap) * 1.4 * a.spinDir;
    g.scale.setScalar(MathUtils.clamp(0.4 + ap * 0.6, 0, 1.2));

    let wobble = 0;
    if (a.shakeT > 0) {
      a.shakeT = Math.max(0, a.shakeT - dt);
      wobble = Math.sin(a.shakeT * 46) * 0.13 * (a.shakeT / 0.5);
    }
    f.rotation.set(a.flip.x * Math.PI, 0, wobble + a.hover.x * 0.03);

    // Hidden while face down (it'd poke through the board), elastic on the way up.
    const scale = Math.max(0, a.pop.x) * smooth(0.3, 0.6, a.flip.x);
    p.scale.setScalar(scale + 1e-4);
    p.visible = scale > 0.01;
    p.position.y = HALF + Math.max(0, a.jump.x) * 0.6 + (Math.sin(t * 2.2 + index) * 0.02 + 0.02) * scale;
    p.rotation.y = a.spin.x + Math.sin(t * 1.4 + index * 0.7) * 0.28 * scale;

    if (body.current) body.current.emissive.lerpColors(BLACK, GOLD, a.glow.x * (0.35 + Math.sin(t * 3 + index) * 0.08));

    // The ring: a gold shockwave spreading over the board.
    const r = ring.current;
    if (r && ringMat.current) {
      if (a.ringT >= 0) {
        a.ringT += dt;
        const k = a.ringT / 0.7;
        r.visible = k < 1;
        r.scale.setScalar(0.6 + k * 1.4);
        ringMat.current.opacity = (1 - k) * 0.9;
        if (k >= 1) a.ringT = -1;
      } else {
        r.visible = false;
      }
    }
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    // A tap would leave the tile "hovered" (there's no pointer leaving), so only mice lift it.
    if (e.pointerType !== "mouse") return;
    anim.current.hovered = true;
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    anim.current.hovered = false;
    document.body.style.cursor = "";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    usePairPop.getState().flip(index);
  };

  return (
    <group>
      <mesh ref={ring} position={[position[0], position[1] - HALF + 0.01, position[2]]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.55, 0.68, 48]} />
        <meshStandardMaterial ref={ringMat} color="#eec266" emissive="#e2a940" emissiveIntensity={1.2} transparent depthWrite={false} />
      </mesh>
      <group ref={root} position={position}>
        <group ref={flipper} onPointerOver={over} onPointerOut={out} onClick={click}>
          <mesh geometry={tileGeometry} castShadow receiveShadow>
            <meshStandardMaterial ref={body} color="#f8f2e7" roughness={0.45} metalness={0.02} />
          </mesh>
          {/* The back, on top while face down. */}
          <mesh geometry={faceGeometry} position-y={HALF + 0.002}>
            <meshStandardMaterial map={backTexture} roughness={0.4} />
          </mesh>
          {/* The front, underneath until it's turned over. */}
          <mesh geometry={faceGeometry} position-y={-HALF - 0.002} rotation-x={Math.PI}>
            <meshStandardMaterial map={faceTexture} color={faceColor} roughness={0.45} />
          </mesh>
          {/* Upside down under the tile, so it stands upright once flipped. */}
          <group rotation-x={Math.PI}>
            <group ref={pal} position-y={HALF} scale={0}>
              <Pal id={card.pal} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
