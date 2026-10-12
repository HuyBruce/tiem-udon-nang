import sharp from "sharp";
import { join } from "node:path";

const base = join(process.cwd(), "assets", "sprites");
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const sheets = [
  {
    source: "v3-drinks-core-sheet.png",
    size: 512,
    cuts: [0, 540, 1162, 1650, 2172],
    names: ["sencha", "matcha-latte", "yuzu-soda", "hojicha-tea"],
    prefix: "v3-drink-",
  },
  {
    source: "v3-drinks-expansion-sheet.png",
    size: 512,
    cuts: [0, 620, 1210, 1660, 2172],
    names: ["hojicha-latte", "sakura-tea", "melon-soda", "strawberry-milk"],
    prefix: "v3-drink-",
  },
  {
    source: "v3-drinks-ingredients-sheet.png",
    size: 256,
    cuts: [0, 780, 1430, 2172],
    names: ["sakura", "melon", "strawberry"],
    prefix: "v3-ingredient-",
  },
];

for (const sheet of sheets) {
  const source = join(base, "sources", sheet.source);
  const { height } = await sharp(source).metadata();
  for (const [index, name] of sheet.names.entries()) {
    const left = sheet.cuts[index];
    const width = sheet.cuts[index + 1] - left;
    const output = join(base, `${sheet.prefix}${name}.webp`);
    const piece = await sharp(source)
      .extract({ left, top: 0, width, height })
      .toBuffer();
    await sharp(piece)
      .trim({ background: transparent, threshold: 8 })
      .resize(sheet.size, sheet.size, {
        fit: "contain",
        background: transparent,
      })
      .webp({ quality: 86 })
      .toFile(output);
    console.log(output);
  }
}
