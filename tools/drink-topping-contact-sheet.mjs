import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { DRINK_TOPPINGS } from "../src/data.js";

const entries = Object.entries(DRINK_TOPPINGS);
const layers = [];
const width = 240,
  height = 560;
for (const [i, [id, top]] of entries.entries()) {
  layers.push({
    input: Buffer.from(
      `<svg width="240" height="40"><text x="120" y="25" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#473b2d">${top.name}</text></svg>`,
    ),
    left: i * width,
    top: 0,
  });
  layers.push({
    input: await sharp(`test-results/v3-drink-topping-${id}-brew-390.png`)
      .resize(width, height - 40, { fit: "contain", background: "#f5ebdd" })
      .png()
      .toBuffer(),
    left: i * width,
    top: 40,
  });
}
await mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: width * entries.length,
    height,
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(layers)
  .png()
  .toFile("docs/review/v3-drink-toppings-contact-sheet.png");
