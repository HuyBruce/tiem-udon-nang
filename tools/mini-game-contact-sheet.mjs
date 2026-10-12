import fs from "node:fs/promises";
import sharp from "sharp";

const scenes = [
  "fryer",
  "chop",
  "pot-water",
  "handmade-2",
  "whisk",
  "coffee-art",
];
const width = 390;
const height = 844;
const gap = 20;
const columns = 3;
const tiles = [];

for (const [index, scene] of scenes.entries()) {
  const file = `test-results/v3-${scene}-390.png`;
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
    height: 2 * (height + gap) + gap,
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(tiles)
  .png()
  .toFile("docs/review/v3-mini-game-contact-sheet.png");
