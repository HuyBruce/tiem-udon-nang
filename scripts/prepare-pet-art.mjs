import sharp from "sharp";
import fs from "node:fs/promises";
import job from "../assets/jobs/v3-pets.json" with { type: "json" };
const manifest = JSON.parse(await fs.readFile("assets/manifest.json", "utf8"));
for (const entry of job.entries) {
  const source = `assets/${entry.source}`;
  const meta = await sharp(source).metadata();
  if (!meta.hasAlpha || meta.width % 3 || meta.height % 2)
    throw new Error("Invalid pose sheet: " + source);
  const width = meta.width / 3,
    height = meta.height / 2;
  for (const [i, pose] of job.poses.entries()) {
    const file = `sprites/v3-pet-${entry.id}-${pose}.webp`;
    await sharp(source)
      .extract({
        left: (i % 3) * width,
        top: Math.floor(i / 3) * height,
        width,
        height,
      })
      .resize(384, 384)
      .webp({ quality: 90, effort: 6 })
      .toFile(`assets/${file}`);
    manifest.assets[`pet-${entry.id}-${pose}`] = {
      file,
      source: entry.source,
      width: 384,
      height: 384,
      anchor: [0.5, 1],
      transparent: true,
      status: "ready",
      artVersion: 3,
    };
  }
}
await fs.writeFile(
  "assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Prepared twelve transparent pet poses.");
