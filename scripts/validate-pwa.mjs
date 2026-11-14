import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const manifest = JSON.parse(readFileSync("out/manifest.webmanifest", "utf8"));
for (const field of ["id", "start_url", "scope"]) assert.equal(manifest[field], `${base}/`);
assert.equal(manifest.display, "standalone");
assert.equal(manifest.prefer_related_applications, false);
for (const size of [192, 512]) {
  const icon = manifest.icons.find((item) => item.sizes === `${size}x${size}`);
  assert.ok(icon);
  assert.equal(icon.src, `${base}/icon-${size}.png`);
  assert.equal(icon.type, "image/png");
  for (const purpose of ["any", "maskable"]) assert.ok(manifest.icons.some((item) => item.sizes === icon.sizes && item.src === icon.src && item.purpose === purpose));
  const png = readFileSync(`out/icon-${size}.png`);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
for (const route of ["", "login/", "dashboard/", "auth/callback/"]) {
  const html = readFileSync(`out/${route}index.html`, "utf8");
  assert.ok(html.includes(`href="${base}/manifest.webmanifest"`), `Manifest link: ${route}`);
  assert.ok(html.includes('name="theme-color" content="#12324a"'));
  assert.ok(html.includes(`href="${base}/icon-192.png"`));
}
assert.ok(readFileSync("out/offline.html", "utf8").includes("Estás sin conexión"));
// Hash the complete export so every published version gets its own asset cache.
function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => entry.isDirectory() ? filesIn(join(dir, entry.name)) : [join(dir, entry.name)]);
}
const hash = createHash("sha256");
for (const path of filesIn("out").filter((path) => !path.endsWith("sw.js"))) {
  hash.update(path.replaceAll("\\", "/"));
  hash.update(readFileSync(path));
}
const worker = readFileSync("public/sw.js", "utf8").replaceAll("__BUILD_VERSION__", hash.digest("hex").slice(0, 16));
writeFileSync("out/sw.js", worker);
console.log(`PWA export validated for ${base || "/"}; service worker versioned.`);

