import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { REVEAL_ANGLE, angleToQuaternion } from "../scene/angles";

// Album pictures: each solved object lit on the game's wall, casting its shadow. One shared
// offscreen renderer draws them one at a time, so the album never holds dozens of WebGL contexts.

const SIZE = 320;
/** Matches HiddenModel and the game's camera, so objects sit in the frame the same way. */
const TARGET_SIZE = 4.2;
const WALL_Z = -4.5;

interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  loader: GLTFLoader;
}

let stage: Stage | null = null;

function setup(): Stage {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = ACESFilmicToneMapping; // R3F's default, so colours match the game
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.1));
  // Off to one side, so the shadow falls beside the object instead of hiding behind it.
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(3.5, 4, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
  scene.add(sun);

  const wall = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: "#f4ecd8", roughness: 1 }));
  wall.position.z = WALL_Z;
  wall.receiveShadow = true;
  scene.add(wall);

  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return { renderer, scene, camera, loader };
}

async function draw(modelUrl: string): Promise<string> {
  stage ??= setup();
  const { renderer, scene, camera, loader } = stage;
  const { scene: model } = await loader.loadAsync(modelUrl);

  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const scale = TARGET_SIZE / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(scale);
  model.position.copy(box.getCenter(new Vector3()).multiplyScalar(-scale));
  model.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = true;
  });
  const pivot = new Group();
  pivot.quaternion.copy(angleToQuaternion(REVEAL_ANGLE));
  pivot.add(model);

  scene.add(pivot);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/webp", 0.85);
  scene.remove(pivot);

  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((m) => m.dispose());
  });
  return url;
}

const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

/** A picture of the revealed object; drawn once per page load, in request order. */
export function thumbnail(modelUrl: string): Promise<string> {
  let url = cache.get(modelUrl);
  if (!url) {
    url = queue.then(() => draw(modelUrl));
    queue = url.catch(() => {});
    // A failed model can be retried next time it's asked for.
    url.catch(() => cache.delete(modelUrl));
    cache.set(modelUrl, url);
  }
  return url;
}
