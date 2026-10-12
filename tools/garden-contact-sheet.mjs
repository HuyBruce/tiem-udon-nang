import fs from "node:fs/promises";
import sharp from "sharp";
import manifest from "../assets/manifest.json" with { type: "json" };
import plantArt from "../data/plant-art.json" with { type: "json" };

const kinds = ["onion", "flowers", "yuzu"];
const stages = ["sprout", "growing", "ripe", "wilted"];
const cellWidth = 250;
const cellHeight = 190;
const gap = 12;
const composites = [];

for (const [row, kind] of kinds.entries()) {
  for (const [column, stage] of stages.entries()) {
    const x = gap + column * (cellWidth + gap);
    const y = gap + row * (cellHeight + gap);
    const name = `${kind} · ${stage}`;
    const label = Buffer.from(
      `<svg width="${cellWidth}" height="32"><text x="12" y="23" font-family="Arial" font-size="17" fill="#3f5b45">${name}</text></svg>`,
    );
    composites.push({ input: label, left: x, top: y });
    const asset = manifest.assets[plantArt[kind][stage]];
    const image = await sharp(`assets/${asset.file}`)
      .resize({
        width: stage === "growing" ? 168 : 205,
        height: 137,
        fit: "inside",
      })
      .png()
      .toBuffer();
    const { width, height } = await sharp(image).metadata();
    composites.push({
      input: image,
      left: x + Math.floor((cellWidth - width) / 2),
      top: y + cellHeight - height - 8,
    });
  }
}

const width = stages.length * (cellWidth + gap) + gap;
const height = kinds.length * (cellHeight + gap) + gap;
await fs.mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width,
    height,
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(composites)
  .png()
  .toFile("docs/review/v3-garden-contact-sheet.png");
