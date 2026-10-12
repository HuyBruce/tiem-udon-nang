import sharp from "sharp";
import { join } from "node:path";

const base = join(process.cwd(), "assets", "sprites");
const source = join(base, "sources", "v3-storage-floor-supplies.png");
const output = join(base, "v3-storage-floor-supplies.webp");

await sharp(source)
  .extract({ left: 48, top: 120, width: 1768, height: 650 })
  .resize(1100, 405, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 87, effort: 6 })
  .toFile(output);

console.log(output);
