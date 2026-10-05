// Head-and-shoulders pictures of avatars, for the header, profile and leaderboards. One
// small offscreen renderer draws them on demand; each config is drawn once and cached.
// Loaded lazily: three.js only comes in when a portrait is first needed.
import { avatarKey, type AvatarConfig } from "@shadow/shared";

const SIZE = 160;
const cache = new Map<string, Promise<string>>();

type Three = typeof import("three");
let setup: Promise<(config: AvatarConfig) => Promise<string>> | null = null;

async function createRenderer() {
  const THREE: Three = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { buildAvatar, characterUrl, GLASSES_URL, SUNGLASSES_URL } = await import("./build");

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#fff6e6", "#5a655a", 2.2));
  const key = new THREE.DirectionalLight("#ffffff", 2.4);
  key.position.set(1.2, 2, 2);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
  camera.position.set(0.32, 0.62, 1.25);
  camera.lookAt(0, 0.43, 0);

  const loader = new GLTFLoader();
  const files = new Map<string, Promise<{ scene: import("three").Object3D; animations: import("three").AnimationClip[] }>>();
  const load = (url: string) => {
    if (!files.has(url)) files.set(url, loader.loadAsync(url));
    return files.get(url)!;
  };

  return async (config: AvatarConfig) => {
    const [body, head, glasses, sunglasses] = await Promise.all([
      load(characterUrl(config.body)),
      load(characterUrl(config.head)),
      load(GLASSES_URL),
      load(SUNGLASSES_URL),
    ]);
    const { root, animations } = buildAvatar(config, body, head, { glasses: glasses.scene, sunglasses: sunglasses.scene });
    // Stand in the idle pose rather than the bind pose.
    const idle = animations.find((a) => a.name === "idle");
    if (idle) {
      const mixer = new THREE.AnimationMixer(root);
      mixer.clipAction(idle).play();
      mixer.update(0.2);
    }
    root.rotation.y = 0.35;
    scene.add(root);
    renderer.render(scene, camera);
    scene.remove(root);
    return renderer.domElement.toDataURL("image/png");
  };
}

/** A data URL picture of the avatar. */
export function avatarPortrait(config: AvatarConfig): Promise<string> {
  const k = avatarKey(config);
  let p = cache.get(k);
  if (!p) {
    setup ??= createRenderer();
    p = setup.then((draw) => draw(config));
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}
