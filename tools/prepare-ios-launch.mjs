import fs from "node:fs/promises";
import sharp from "sharp";
// Technical exports of existing approved art; no new illustrations.
await fs.mkdir("public/launch", { recursive: true });
await sharp("public/icon-192.png")
  .resize(180, 180)
  .png()
  .toFile("public/icon-180.png");
for (const [width, height] of [
  [750, 1334],
  [1170, 2532],
  [1290, 2796],
  [1320, 2868],
])
  await sharp("assets/backgrounds/gdv-world-front.webp")
    .resize(width, height, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, palette: true })
    .toFile(`public/launch/${width}x${height}.png`);
