import { staticFile } from "remotion";
import { useGLTF } from "@react-three/drei";

// Copied from ../assets/models (see manifest.json); already centered and meshopt-compressed.
export const MODELS = {
  chair: staticFile("models/chair.glb"),
  teddyBear: staticFile("models/teddy-bear.glb"),
  astronaut: staticFile("models/astronaut.glb"),
  palmTree: staticFile("models/palm-tree.glb"),
  locomotive: staticFile("models/locomotive.glb"),
  cactus: staticFile("models/cactus.glb"),
  reindeer: staticFile("models/reindeer.glb"),
  spaceship: staticFile("models/spaceship.glb"),
  snowman: staticFile("models/snowman.glb"),
  floorLamp: staticFile("models/floor-lamp.glb"),
  iceCream: staticFile("models/ice-cream.glb"),
  pottedPlant: staticFile("models/potted-plant.glb"),
};

export type ModelName = keyof typeof MODELS;

for (const url of Object.values(MODELS)) useGLTF.preload(url);
