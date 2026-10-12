import sharp from "sharp";
import fs from "node:fs/promises";

const scenes = ["front", "guests0", "drinks", "kitchen", "storage", "garden"];
const sizes = { 320: 568, 390: 844 };
const width = Number(process.argv[2] || 390);
const height = sizes[width];
if (!height) throw new Error("Use 320 or 390 for the screenshot width.");
const tile = { width, height: height + 40 };
const columns = 3;
const layers = [];
for (const [index, scene] of scenes.entries()) {
  const left = (index % columns) * tile.width;
  const top = Math.floor(index / columns) * tile.height;
  layers.push({
    input: await sharp(`test-results/layout-${width}-${scene}.png`)
      .png()
      .toBuffer(),
    left,
    top,
  });
  layers.push({
    input: Buffer.from(
      `<svg width="${width}" height="40"><rect width="${width}" height="40" fill="#f5ebdd"/><text x="${width / 2}" y="27" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#3f5b45">${scene}</text></svg>`,
    ),
    left,
    top: top + height,
  });
}
await fs.mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: columns * tile.width,
    height: 2 * tile.height,
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(layers)
  .png()
  .toFile(`docs/review/v3-six-scenes-${width}.png`);
