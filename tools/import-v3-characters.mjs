import fs from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import { removeBackground } from "./remove_bg.mjs";

const files = [
  "assets/jobs/v3-first-cast-results.json",
  "assets/jobs/v3-cast-results.json",
  "assets/jobs/v3-expression-results.json",
  "assets/jobs/v3-more-expressions-results.json",
];
const manifestPath = "assets/manifest.json";
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
for (const file of files) {
  let batch;
  try {
    batch = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  for (const job of batch.jobs) {
    const output = `assets/characters/v3-${job.id}.webp`;
    if (
      manifest.assets[`v3-${job.id}`]?.status === "ready" &&
      (await fs.stat(output).catch(() => null))
    )
      continue;
    const isOwner = (job.characterId || job.id) === "owner";
    const size = isOwner ? [1024, 1536] : [1024, 1024];
    const source = `assets/characters/sources/v3-${job.id}-green.png`;
    const alpha = `assets/characters/alpha/v3-${job.id}.png`;
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.copyFile(job.source, source);
    const metadata = await sharp(source).metadata();
    const { data } = await sharp(source)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let empty = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) empty++;
    const realAlpha =
      metadata.hasAlpha && empty > metadata.width * metadata.height * 0.1;
    const result = realAlpha
      ? { transparentRatio: empty / (metadata.width * metadata.height) }
      : await removeBackground(source, alpha, size);
    if (realAlpha)
      await sharp(source)
        .resize(...size, { fit: "contain", background: "#00000000" })
        .png()
        .toFile(alpha);
    const display = isOwner ? [512, 768] : [512, 512];
    await sharp(alpha)
      .resize(...display)
      .webp({ quality: 93 })
      .toFile(output);
    manifest.assets[`v3-${job.id}`] = {
      file: output.slice(7),
      source: source.slice(7),
      width: display[0],
      height: display[1],
      anchor: [0.5, 1],
      transparent: true,
      status: "ready",
      artVersion: 3,
      sourceFrame: size,
      alphaRatio: result.transparentRatio,
    };
    console.log(
      `Imported ${job.id} (${display.join("×")}, ${(result.transparentRatio * 100).toFixed(1)}% transparent)`,
    );
  }
}
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
