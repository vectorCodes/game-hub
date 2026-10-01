// Normalizes the catalog's source models into assets/models/<hash>.glb:
// centered, scaled to a unit bounding box, stripped of every name (names would leak
// the answer), and meshopt-compressed. Writes assets/models/manifest.json (id → key).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { ImageUtils, Logger, NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { center, dedup, getBounds, prune, quantize, reorder, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { MANIFEST_PATH, MODELS_DIR, RAW_DIR, readCatalog } from "./paths";

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

function indexKit(kit: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".glb")) files.set(basename(entry.name, ".glb"), path);
    }
  };
  walk(resolve(RAW_DIR, kit));
  return files;
}

function scaleToUnit(doc: Document) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const s = 1 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  for (const node of scene.listChildren()) {
    const [tx, ty, tz] = node.getTranslation();
    const [sx, sy, sz] = node.getScale();
    node.setTranslation([tx * s, ty * s, tz * s]);
    node.setScale([sx * s, sy * s, sz * s]);
  }
}

function anonymize(doc: Document) {
  const root = doc.getRoot();
  const props = [
    ...root.listScenes(), ...root.listNodes(), ...root.listMeshes(), ...root.listMaterials(),
    ...root.listTextures(), ...root.listAccessors(), ...root.listBuffers(), ...root.listAnimations(),
    ...root.listSkins(), ...root.listCameras(),
  ];
  for (const prop of props) prop.setName("").setExtras({});
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) prim.setExtras({});
  root.listTextures().forEach((t, i) => t.setURI(`t${i}.${ImageUtils.mimeTypeToExtension(t.getMimeType())}`));
  root.getAsset().extras = {};
}

const kitIndex = new Map<string, Map<string, string>>();
const manifest: Record<string, string> = {};

for (const { id, source } of readCatalog()) {
  const [kit, file] = source.split("/");
  if (!kitIndex.has(kit)) kitIndex.set(kit, indexKit(kit));
  const path = kitIndex.get(kit)!.get(file);
  if (!path) throw new Error(`${id}: ${source}.glb not found. Run \`pnpm models:fetch\` first.`);

  const doc = await io.read(path); // external textures resolve relative to the file
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  await doc.transform(dedup(), prune(), weld(), center({ pivot: "center" }));
  scaleToUnit(doc);
  anonymize(doc);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  });
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize());

  const bytes = await io.writeBinary(doc);
  const key = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  writeFileSync(resolve(MODELS_DIR, `${key}.glb`), bytes);
  manifest[id] = key;
  console.log(`${id.padEnd(18)} ${key}  ${(bytes.byteLength / 1024).toFixed(1)} KB  ← ${dirname(path).split("/").pop()}`);
}

// Drop models no longer referenced by the catalog.
const keep = new Set(Object.values(manifest).map((k) => `${k}.glb`));
for (const f of readdirSync(MODELS_DIR)) {
  if (f.endsWith(".glb") && !keep.has(f)) rmSync(resolve(MODELS_DIR, f));
}
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\n${Object.keys(manifest).length} models → ${MODELS_DIR}`);

// Sanity check: no catalog name may survive in the output files.
const leaks = readCatalog().filter(({ id, source }) => {
  const text = readFileSync(resolve(MODELS_DIR, `${manifest[id]}.glb`)).toString("latin1");
  return text.includes(`"${source.split("/")[1]}"`);
});
if (leaks.length) throw new Error(`Name leaked in: ${leaks.map((l) => l.id).join(", ")}`);
