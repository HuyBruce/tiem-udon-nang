import fs from "node:fs/promises";
import sharp from "sharp";

const job = JSON.parse(await fs.readFile("assets/jobs/v3-ingredient-art.json", "utf8"));
const ids = Object.keys(job.sources);
const width = 6 * 192;
const height = 4 * 220;
const layers = [];
for (const [i, id] of ids.entries()) {
  const left = (i % 6) * 192;
  const top = Math.floor(i / 6) * 220;
  const input = await sharp(`assets/sprites/v3-ingredient-${id}.webp`)
    .resize(170, 170)
    .toBuffer();
  layers.push({ input, left: left + 11, top: top + 5 });
  const label = Buffer.from(`<svg width="192" height="35"><text x="96" y="25" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#4a5a3e">${id}</text></svg>`);
  layers.push({ input: label, left, top: top + 175 });
}
await fs.mkdir("test-results", { recursive: true });
await sharp({ create: { width, height, channels: 4, background: "#f5ebdd" } })
  .composite(layers)
  .png()
  .toFile("test-results/v3-ingredient-sheet.png");
