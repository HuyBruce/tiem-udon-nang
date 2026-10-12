import sharp from "sharp";
import { join } from "node:path";

const base = join(process.cwd(), "assets", "sprites");
const source = join(base, "sources", "v3-wooden-tray.png");
const output = join(base, "v3-wooden-tray.webp");

await sharp(source)
  .extract({ left: 50, top: 165, width: 2072, height: 395 })
  .resize(1200, 240, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 88, effort: 6 })
  .toFile(output);

console.log(output);
