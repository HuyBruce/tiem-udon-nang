import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import drinks from "../data/drinks.json" with { type: "json" };
import manifest from "../assets/manifest.json" with { type: "json" };

const width = 360,
  height = 220;
const layers = [];
const entries = Object.values(drinks).filter((drink) => drink.coldAsset);
for (const [index, drink] of entries.entries()) {
  const left = (index % 3) * width,
    top = Math.floor(index / 3) * height;
  const title = `<svg width="${width}" height="45"><text x="180" y="21" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#473b2d">${drink.name}</text><text x="88" y="41" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#5b7154">Nóng</text><text x="268" y="41" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#5b7154">Lạnh</text></svg>`;
  layers.push({ input: Buffer.from(title), left, top });
  for (const [column, assetId] of [drink.asset, drink.coldAsset].entries())
    layers.push({
      input: await sharp(`assets/${manifest.assets[assetId].file}`)
        .resize(160, 160)
        .png()
        .toBuffer(),
      left: left + 8 + column * 180,
      top: top + 48,
    });
}
await mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: width * 3,
    height: height * 2,
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(layers)
  .png()
  .toFile("docs/review/v3-cold-drinks-contact-sheet.png");
