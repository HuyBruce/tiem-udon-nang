import fs from "node:fs/promises";
import sharp from "sharp";

const scenes = ["front", "guests0", "drinks", "kitchen", "storage", "garden"];
const width = 390;
const height = 844;
const gap = 20;
const columns = 3;
const rows = 2;
const tiles = [];

for (const [index, scene] of scenes.entries()) {
  const file = `test-results/layout-390-${scene}.png`;
  await fs.access(file);
  tiles.push({
    input: await sharp(file).resize(width, height).png().toBuffer(),
    left: gap + (index % columns) * (width + gap),
    top: gap + Math.floor(index / columns) * (height + gap),
  });
}

await fs.mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: columns * (width + gap) + gap,
    height: rows * (height + gap) + gap,
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(tiles)
  .png()
  .toFile("docs/review/six-scenes-current.png");
