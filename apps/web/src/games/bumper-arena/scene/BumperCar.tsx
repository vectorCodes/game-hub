// A fairground bumper car, low-poly to sit with the Kenney art: a glossy rounded tub in the
// rider's colour with a cockpit, a fat black rubber bumper all round, a padded seat back, a
// steering wheel, headlights, a racing stripe, and the pole with a spark on top. Facing +z.
// The bumper's footprint is the physics ring (radius 0.6).
import { useEffect, useMemo, type RefObject, type Ref } from "react";
import { Color, ExtrudeGeometry, MeshStandardMaterial, Path, Shape, Vector2 } from "three";

/** A rounded-rectangle-ish oval (a superellipse) in the extrude's plane, centred at (0, cy). */
function oval(a: number, b: number, cy = 0, n = 2.6, steps = 48): Vector2[] {
  const pts: Vector2[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push(new Vector2(a * Math.sign(c) * Math.abs(c) ** (2 / n), cy + b * Math.sign(s) * Math.abs(s) ** (2 / n)));
  }
  return pts;
}

// One shared tub: lying flat (rotation x = -90°), the shape's +y is the car's back (-z).
let tub: ExtrudeGeometry | null = null;
function tubGeometry() {
  if (tub) return tub;
  const shape = new Shape(oval(0.5, 0.56));
  shape.holes.push(new Path(oval(0.3, 0.28, 0.08).reverse()));
  tub = new ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 4, curveSegments: 6 });
  return tub;
}

/** `glowRef` gets the headlights' shared material, to flare on a dash. */
export function BumperCar({ color, bodyRef, glowRef }: { color: string; bodyRef?: Ref<MeshStandardMaterial>; glowRef?: RefObject<MeshStandardMaterial | null> }) {
  const geometry = tubGeometry();
  const headlight = useMemo(() => new MeshStandardMaterial({ color: "#fff6d6", emissive: "#ffe9a3", emissiveIntensity: 0.3, roughness: 0.2 }), []);
  useEffect(() => {
    if (glowRef) glowRef.current = headlight;
  }, [glowRef, headlight]);
  const seat = useMemo(() => "#" + new Color(color).lerp(new Color("#2a2216"), 0.45).getHexString(), [color]);
  return (
    <group>
      {/* The rubber bumper, all the way round. */}
      <mesh position-y={0.16} rotation-x={Math.PI / 2} scale={[1, 1.08, 1]} castShadow>
        <torusGeometry args={[0.53, 0.1, 10, 40]} />
        <meshStandardMaterial color="#26231f" roughness={0.9} />
      </mesh>
      {/* Chassis and the cockpit floor. */}
      <mesh position-y={0.1} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.46, 0.08, 28]} />
        <meshStandardMaterial color="#3a3632" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.15, -0.08]} scale={[1, 1, 0.95]}>
        <cylinderGeometry args={[0.3, 0.3, 0.02, 24]} />
        <meshStandardMaterial color="#1f1c19" roughness={0.9} />
      </mesh>
      {/* The tub. */}
      <mesh geometry={geometry} rotation-x={-Math.PI / 2} position-y={0.17} castShadow receiveShadow>
        <meshStandardMaterial ref={bodyRef} color={color} roughness={0.28} metalness={0.15} />
      </mesh>
      {/* Racing stripe over the nose. */}
      <mesh position={[0, 0.447, 0.42]}>
        <boxGeometry args={[0.12, 0.01, 0.26]} />
        <meshStandardMaterial color="#fbf3e6" roughness={0.4} />
      </mesh>
      {/* Padded seat back. */}
      <mesh position={[0, 0.5, -0.27]} rotation-y={Math.PI}>
        <cylinderGeometry args={[0.29, 0.29, 0.34, 16, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={seat} roughness={0.7} />
      </mesh>
      {/* Steering wheel on its column. */}
      <mesh position={[0, 0.47, 0.25]} rotation-x={0.6}>
        <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} />
        <meshStandardMaterial color="#3a3632" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, 0.2]} rotation-x={-1}>
        <torusGeometry args={[0.1, 0.022, 8, 20]} />
        <meshStandardMaterial color="#26231f" roughness={0.5} />
      </mesh>
      {/* Headlights. */}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.34, 0.6]} material={headlight}>
          <sphereGeometry args={[0.055, 10, 8]} />
        </mesh>
      ))}
      {/* The pole, with its spark. */}
      <mesh position={[0, 0.98, -0.45]}>
        <cylinderGeometry args={[0.022, 0.022, 1.1, 8]} />
        <meshStandardMaterial color="#c9c6c0" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.55, -0.45]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshStandardMaterial color="#ffd23f" emissive="#ffb000" emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}
