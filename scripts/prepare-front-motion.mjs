import fs from "node:fs/promises";
import sharp from "sharp";
import job from "../assets/jobs/v3-front-motion.json" with { type: "json" };
const manifest = JSON.parse(await fs.readFile("assets/manifest.json", "utf8"));
for (const entry of job.entries) {
  let pipeline = sharp(`assets/${entry.source}`);
  if (entry.alpha) {
    if (!(await pipeline.metadata()).hasAlpha)
      throw new Error("Missing alpha: " + entry.id);
    pipeline = pipeline
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
      .resize({ height: 512 });
  }
  await pipeline
    .webp({ quality: 90, effort: 6 })
    .toFile(`assets/${entry.output}`);
  const meta = await sharp(`assets/${entry.output}`).metadata();
  manifest.assets[
    entry.id === "front-background" ? "v5-front-motion" : "front-" + entry.id
  ] = {
    file: entry.output,
    source: entry.source,
    width: meta.width,
    height: meta.height,
    transparent: entry.alpha,
    anchor: [0.5, 0],
    status: "ready",
  };
}
for (const name of ["moon", "drop"])
  manifest.assets["ui-" + name] = {
    file: `ui/${name}.svg`,
    width: 24,
    height: 24,
    transparent: true,
    status: "ready",
  };
await fs.writeFile(
  "assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Prepared independent front curtain, lantern, clean background and care icons.",
);
