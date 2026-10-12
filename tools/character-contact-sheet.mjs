import fs from "node:fs/promises";
import sharp from "sharp";

const { jobs } = JSON.parse(
  await fs.readFile("assets/jobs/v3-character-results.json", "utf8"),
);
const columns = jobs.length,
  cell = 360,
  row = 410,
  tiles = [];
for (const [index, job] of jobs.entries()) {
  for (const [y, background] of ["#F5EBDD", "#263B31"].entries()) {
    tiles.push({
      input: await sharp(job.output)
        .resize(cell, cell)
        .flatten({ background })
        .png()
        .toBuffer(),
      left: index * cell,
      top: y * row,
    });
    tiles.push({
      input: Buffer.from(
        `<svg width="360" height="50"><rect width="360" height="50" fill="${background}"/><text x="180" y="31" text-anchor="middle" font-family="sans-serif" font-size="23" fill="${y ? "#F5EBDD" : "#3F5B45"}">${job.id.toUpperCase()}</text></svg>`,
      ),
      left: index * cell,
      top: y * row + cell,
    });
  }
}
await fs.mkdir("docs/review", { recursive: true });
await sharp({
  create: {
    width: cell * columns,
    height: row * 2,
    channels: 4,
    background: "#F5EBDD",
  },
})
  .composite(tiles)
  .png()
  .toFile("docs/review/contact_sheet_characters.png");
console.log("Saved docs/review/contact_sheet_characters.png");
