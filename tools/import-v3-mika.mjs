import fs from "node:fs/promises";
import sharp from "sharp";
import { removeBackground } from "./remove_bg.mjs";

const manifestPath = "assets/manifest.json";
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
for (const frame of ["neutral", "happy", "thinking", "sad"]) {
  const id = `v3-mika${frame === "neutral" ? "" : `-${frame}`}`;
  const source = `assets/characters/sources/v3-mika-${frame}${frame === "neutral" ? "" : "-green"}.png`;
  const alpha = `assets/characters/alpha/${id}.png`;
  const output = `assets/characters/${id}.webp`;
  let transparentRatio;
  if (frame === "neutral") {
    await sharp(source)
      .resize(1024, 1024, { fit: "contain", background: "#00000000" })
      .png()
      .toFile(alpha);
    const { data, info } = await sharp(alpha)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let empty = 0;
    for (let i = 3; i < data.length; i += 4) if (!data[i]) empty++;
    transparentRatio = empty / (info.width * info.height);
  } else {
    ({ transparentRatio } = await removeBackground(source, alpha));
  }
  await sharp(alpha).resize(512, 512).webp({ quality: 93 }).toFile(output);
  manifest.assets[id] = {
    file: output.slice(7),
    source: source.slice(7),
    width: 512,
    height: 512,
    anchor: [0.5, 1],
    transparent: true,
    status: "ready",
    artVersion: 3,
    sourceFrame: [1024, 1024],
    alphaRatio: transparentRatio,
  };
  console.log(`${id}: ${(transparentRatio * 100).toFixed(1)}% alpha`);
}
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
