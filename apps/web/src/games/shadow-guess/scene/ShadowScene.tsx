import { Component, Suspense, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { AmbientLight } from "three";
import type { LightAngle } from "@shadow/shared";
import { HiddenModel } from "./HiddenModel";
import type { SnapshotHandler } from "./useShadowSnapshots";

// Far enough behind the object (max half-diagonal ≈ 3.7) that no rotation clips into it.
const WALL_Z = -4.5;

interface Props {
  modelUrl: string;
  angle: LightAngle;
  revealed: boolean;
  /** Remounts the model when it changes (e.g. a new session), resetting its state. */
  sessionKey?: string;
  snap?: boolean;
  orbit?: boolean;
  snapshotAngles?: LightAngle[];
  onSnapshot?: SnapshotHandler;
  onReady?: () => void;
  onError?: () => void;
}

export function ShadowScene({ sessionKey, orbit, revealed, onError, ...model }: Props) {
  return (
    <Canvas shadows camera={{ position: [0, 0, 10], fov: 34 }} dpr={[1, 2]}>
      <RevealAmbient revealed={revealed} />
      <directionalLight
        position={[0, 0, 10]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-4.5, 4.5, 4.5, -4.5, 0.5, 30]} />
      </directionalLight>

      <mesh position={[0, 0, WALL_Z]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#f4ecd8" roughness={1} />
      </mesh>

      <ModelErrorBoundary key={model.modelUrl} onError={onError}>
        <Suspense fallback={null}>
          <HiddenModel key={sessionKey ?? model.modelUrl} revealed={revealed} {...model} />
        </Suspense>
      </ModelErrorBoundary>

      {orbit && <OrbitControls enablePan={false} minDistance={7} maxDistance={16} />}
    </Canvas>
  );
}

/** Dim room while guessing (a dark, crisp shadow); lights come up on reveal. */
function RevealAmbient({ revealed }: { revealed: boolean }) {
  const light = useRef<AmbientLight>(null);
  useFrame((_, delta) => {
    const target = revealed ? 1.1 : 0.12;
    light.current!.intensity += (target - light.current!.intensity) * (1 - Math.exp(-delta * 3));
  });
  return <ambientLight ref={light} intensity={revealed ? 1.1 : 0.12} />;
}

class ModelErrorBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
