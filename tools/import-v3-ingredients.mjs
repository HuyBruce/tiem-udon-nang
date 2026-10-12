import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const job = JSON.parse(await fs.readFile("assets/jobs/v3-ingredient-art.json", "utf8"));
const manifestPath = "assets/manifest.json";
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
await fs.mkdir("assets/sprites/sources", { recursive: true });
for (const [id, filename] of Object.entries(job.sources)) {
  const source = `assets/sprites/sources/v3-ingredient-${id}.png`;
  const output = `assets/sprites/v3-ingredient-${id}.webp`;
  await fs.copyFile(path.join(job.sourceRoot, filename), source);
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let visible = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparent++;
    if (data[i] >= 240) visible++;
  }
  const total = info.width * info.height;
  if (transparent < total * 0.1 || visible < total * 0.05)
    throw new Error(`Invalid alpha for ingredient ${id}`);
  await sharp(source)
    .resize(256, 256, { fit: "contain", background: "#00000000" })
    .webp({ quality: 88 })
    .toFile(output);
  manifest.assets[`ingredient-${id}`] = {
    file: output.slice(7),
    source: source.slice(7),
    width: 256,
    height: 256,
    anchor: [0.5, 1],
    transparent: true,
    status: "ready",
    artVersion: 3,
    sourceFrame: [info.width, info.height],
    alphaRatio: transparent / total,
  };
  console.log(`${id}: ${(transparent / total * 100).toFixed(1)}% transparent`);
}
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
