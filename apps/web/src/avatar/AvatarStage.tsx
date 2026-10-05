// The customizer's 3D preview: the avatar on a lit turntable. Drag to turn it; it cheers
// whenever something changes. Lazy-loaded with the /avatar page.
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useAnimations } from "@react-three/drei";
import { LoopOnce, type AnimationAction, type Group } from "three";
import { avatarKey, type AvatarConfig } from "@shadow/shared";
import { animateAccessories } from "./build";
import { useAvatarModel } from "./useAvatarModel";

function Figure({ config }: { config: AvatarConfig }) {
  const { root, animations } = useAvatarModel(config);
  const group = useRef<Group>(null);
  const { actions } = useAnimations(animations, group);
  const idle = useRef<AnimationAction | null>(null);

  useEffect(() => {
    idle.current = actions.idle ?? null;
    idle.current?.reset().fadeIn(0.2).play();
    // A cheer for every change.
    const cheer = actions["emote-yes"];
    if (cheer) {
      cheer.setLoop(LoopOnce, 1);
      cheer.reset().fadeIn(0.1).play();
      const t = setTimeout(() => cheer.fadeOut(0.25), 650);
      return () => clearTimeout(t);
    }
  }, [actions, root]);

  useFrame((_, dt) => animateAccessories(root, dt));

  return (
    <group ref={group} scale={2.6}>
      <primitive object={root} />
    </group>
  );
}

export default function AvatarStage({ config }: { config: AvatarConfig }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, position: [0.4, 1.3, 4.4] }}>
      <hemisphereLight args={["#fff3dd", "#3d473f", 1.4]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.4} castShadow shadow-mapSize={1024} />
      <pointLight position={[-2, 1.6, -1.5]} color="#f4b94e" intensity={6} />
      <Suspense fallback={null}>
        <Figure key={avatarKey(config)} config={config} />
      </Suspense>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[1.1, 48]} />
        <meshStandardMaterial color="#263029" roughness={0.9} />
      </mesh>
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={3} blur={2.4} far={2} />
      <OrbitControls
        target={[0, 0.95, 0]}
        enablePan={false}
        minDistance={2.4}
        maxDistance={6}
        minPolarAngle={0.9}
        maxPolarAngle={1.62}
        autoRotate
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
