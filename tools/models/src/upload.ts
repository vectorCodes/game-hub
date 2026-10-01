// Uploads assets/models/*.glb to the public Supabase Storage bucket "models".
// Keys are content hashes, so files are immutable and cached for a year.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { MODELS_DIR } from "./paths";

const BUCKET = "models";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data: bucket } = await supabase.storage.getBucket(BUCKET);
if (!bucket) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
}

const files = readdirSync(MODELS_DIR).filter((f) => f.endsWith(".glb"));
for (const file of files) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(file, readFileSync(resolve(MODELS_DIR, file)), {
      contentType: "model/gltf-binary",
      cacheControl: "31536000",
      upsert: true,
    });
  if (error) throw new Error(`${file}: ${error.message}`);
}
console.log(`Uploaded ${files.length} models to ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`);
