import fs from "node:fs/promises";
import sharp from "sharp";

const ids = [
  "owner",
  "mai",
  "an",
  "ha",
  "son",
  "linh",
  "ken",
  "vip",
  "thu",
  "binh",
  "yui",
];
const cell = 240,
  label = 36,
  columns = 4,
  rows = Math.ceil(ids.length / columns);
const tiles = [];
for (const [i, id] of ids.entries()) {
  const source = `assets/characters/v3-${id}.webp`;
  const left = (i % columns) * cell,
    top = Math.floor(i / columns) * (cell + label);
  tiles.push({
    input: await sharp(source)
      .resize(cell, cell, { fit: "contain", background: "#f5ebdd" })
      .flatten({ background: "#f5ebdd" })
      .png()
      .toBuffer(),
    left,
    top,
  });
  tiles.push({
    input: Buffer.from(
      `<svg width="240" height="36"><rect width="240" height="36" fill="#f5ebdd"/><text x="120" y="25" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#3f5b45">${id}</text></svg>`,
    ),
    left,
    top: top + cell,
  });
}
await fs.mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: columns * cell,
    height: rows * (cell + label),
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(tiles)
  .png()
  .toFile("docs/review/v3-cast-contact-sheet.png");
console.log("Saved v3 cast contact sheet");
