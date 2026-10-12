import fs from "node:fs/promises";
import sharp from "sharp";

const manifest = JSON.parse(await fs.readFile("assets/manifest.json", "utf8"));
const ids = process.argv.slice(2);
if (!ids.length) ids.push("v2-seating", "v2-foliage", "v2-an");
const width = 320,
  height = 620,
  columns = Math.min(3, ids.length);
const tiles = [];
for (const [i, id] of ids.entries()) {
  if (!/^[a-z0-9_-]+$/i.test(id) || !manifest.assets[id])
    throw new Error(`Unknown asset: ${id}`);
  const asset = manifest.assets[id];
  const left = (i % columns) * width,
    top = Math.floor(i / columns) * height;
  tiles.push({
    input: await sharp("assets/" + asset.file)
      .resize(width - 24, height - 65, {
        fit: "contain",
        background: "#f1ddd3",
      })
      .png()
      .toBuffer(),
    left: left + 12,
    top: top + 12,
  });
  tiles.push({
    input: Buffer.from(
      `<svg width="320" height="40"><text x="12" y="17" font-family="sans-serif" font-size="16" fill="#3f5b45">${id}</text><text x="12" y="35" font-family="sans-serif" font-size="12" fill="#7a4f35">${asset.width} x ${asset.height} · ${asset.transparent ? "alpha" : "background"}</text></svg>`,
    ),
    left,
    top: top + height - 45,
  });
}
await fs.mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: columns * width,
    height: Math.ceil(ids.length / columns) * height,
    channels: 4,
    background: "#f1ddd3",
  },
})
  .composite(tiles)
  .png()
  .toFile("docs/review/v2-contact-sheet.png");
console.log(`Saved contact sheet for ${ids.length} assets.`);
