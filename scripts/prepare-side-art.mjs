import sharp from "sharp";
import fs from "node:fs/promises";
const manifest = JSON.parse(await fs.readFile("assets/manifest.json", "utf8"));
const source = "sprites/sources/v3-side-food-sheet.png";
const meta = await sharp("assets/" + source).metadata();
if (!meta.hasAlpha || meta.width % 3 || meta.height % 2) throw new Error("Invalid food sheet");
const width = meta.width / 3, height = meta.height / 2;
for (const [i, id] of ["side-karaage", "side-gyoza", "side-tamagoyaki", "side-kimchi", "ingredient-chicken", "ingredient-kimchi"].entries()) {
  const file = `sprites/v3-${id}.webp`;
  const cell = await sharp("assets/" + source).extract({ left: (i % 3) * width, top: Math.floor(i / 3) * height, width, height }).png().toBuffer();
  await sharp(cell).trim().resize(256, 256, { fit: "contain", background: "#00000000" }).webp({ quality: 90 }).toFile("assets/" + file);
  manifest.assets[id] = { file, source, width: 256, height: 256, anchor: [.5, .5], transparent: true, status: "ready", artVersion: 3 };
}
await fs.writeFile("assets/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("Packed four side dishes and two pantry icons.");
