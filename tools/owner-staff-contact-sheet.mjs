import fs from "node:fs/promises";
import sharp from "sharp";

const people = ["owner", "thu", "binh", "yui"];
const expressions = ["neutral", "happy", "sad", "thinking"];
const cellWidth = 240;
const imageHeight = 288;
const labelHeight = 32;
const cells = [];

for (const [row, id] of people.entries()) {
  for (const [column, expression] of expressions.entries()) {
    if (id === "owner" && expression === "thinking") continue;
    const suffix = expression === "neutral" ? "" : `-${expression}`;
    const file = `assets/characters/v3-${id}${suffix}.webp`;
    const left = column * cellWidth;
    const top = row * (imageHeight + labelHeight);
    cells.push({
      input: await sharp(file)
        .resize(cellWidth, imageHeight, {
          fit: "contain",
          background: "#f5ebdd",
        })
        .flatten({ background: "#f5ebdd" })
        .png()
        .toBuffer(),
      left,
      top,
    });
    cells.push({
      input: Buffer.from(
        `<svg width="240" height="32"><rect width="240" height="32" fill="#f5ebdd"/><text x="120" y="23" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#3f5b45">${id} - ${expression}</text></svg>`,
      ),
      left,
      top: top + imageHeight,
    });
  }
}

await fs.mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: cellWidth * expressions.length,
    height: (imageHeight + labelHeight) * people.length,
    channels: 4,
    background: "#f5ebdd",
  },
})
  .composite(cells)
  .png()
  .toFile("docs/review/v3-owner-staff-expressions.png");
