import fs from "node:fs/promises";
import sharp from "sharp";

const ids = ["mai", "an", "ha", "son", "linh", "ken", "vip"],
  emotions = ["neutral", "happy", "very-happy", "sad", "angry", "thinking"];
const cell = 220,
  label = 34,
  tiles = [];
for (const [row, id] of ids.entries())
  for (const [col, emotion] of emotions.entries()) {
    const file = `assets/characters/v3-${id}${emotion === "neutral" ? "" : "-" + emotion}.webp`;
    const left = col * cell,
      top = row * (cell + label);
    tiles.push({
      input: await sharp(file)
        .resize(cell, cell, { fit: "contain", background: "#f5ebdd" })
        .flatten({ background: "#f5ebdd" })
        .png()
        .toBuffer(),
      left,
      top,
    });
    tiles.push({
      input: Buffer.from(
        `<svg width="220" height="34"><rect width="220" height="34" fill="#f5ebdd"/><text x="110" y="24" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#3f5b45">${id} · ${emotion}</text></svg>`,
      ),
      left,
      top: top + cell,
    });
  }
await fs.mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: cell * emotions.length,
    height: (cell + label) * ids.length,
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(tiles)
  .png()
  .toFile("docs/review/v3-expression-contact-sheet.png");
