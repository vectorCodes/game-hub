// Downloads the Kenney kits referenced by assets/catalog.json into assets/raw/<kit>.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RAW_DIR, readCatalog } from "./paths";

const kits = [...new Set(readCatalog().map((o) => o.source.split("/")[0]))];
mkdirSync(RAW_DIR, { recursive: true });

for (const kit of kits) {
  const dir = resolve(RAW_DIR, kit);
  if (existsSync(dir)) {
    console.log(`✓ ${kit} (cached)`);
    continue;
  }
  const page = await (await fetch(`https://kenney.nl/assets/${kit}`)).text();
  const url = page.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/[^"]+\.zip/)?.[0];
  if (!url) throw new Error(`No download link found for ${kit}`);
  const zip = resolve(RAW_DIR, `${kit}.zip`);
  writeFileSync(zip, Buffer.from(await (await fetch(url)).arrayBuffer()));
  execFileSync("unzip", ["-qo", zip, "-d", dir]);
  console.log(`↓ ${kit}`);
}
