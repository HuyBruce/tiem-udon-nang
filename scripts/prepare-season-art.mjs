import sharp from "sharp";
import fs from "node:fs/promises";
const manifest = JSON.parse(await fs.readFile("assets/manifest.json", "utf8"));
const source = "sprites/sources/v3-season-decor-sheet.png", meta = await sharp("assets/" + source).metadata();
if (!meta.hasAlpha || meta.width % 2 || meta.height % 2) throw new Error("Invalid seasonal sheet");
const width = meta.width / 2, height = meta.height / 2;
const names = ["spring", "summer", "autumn", "winter"];
for (const [i, id] of names.entries()) {
  const file = `sprites/v3-season-${id}.webp`;
  const cell = await sharp("assets/" + source).extract({ left: (i % 2) * width, top: Math.floor(i / 2) * height, width, height }).png().toBuffer();
  const { data, info } = await sharp(cell).trim().resize({ width: 512 }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  await fs.writeFile("assets/" + file, data);
  manifest.assets[`season-${id}`] = { file, source, width: info.width, height: info.height, anchor: [.5, 0], transparent: true, status: "ready", artVersion: 3 };
}
await fs.writeFile("assets/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
const decor = JSON.parse(await fs.readFile("data/decor.json", "utf8"));
const balance = JSON.parse(await fs.readFile("config/balance.json", "utf8"));
const desc = ["Cành hoa anh đào", "Lời ước mùa hạ", "Lá phong và bí ngô", "Dải sao mùa đông"];
for (const [i, season] of names.entries()) {
  const id = "season-" + season;
  decor[id] = { name: desc[i], slot: "season", color: ["#dfa0a5", "#a0bf67", "#c57c54", "#94beb6"][i], asset: id };
  balance.prices.decor[id] = { cost: 1500 + i * 100, bonus: .015 };
}
await fs.writeFile("data/decor.json", JSON.stringify(decor, null, 2) + "\n");
await fs.writeFile("config/balance.json", JSON.stringify(balance, null, 2) + "\n");
for (const scene of ["front", "guests", "drinks", "kitchen", "storage", "garden"]) {
  const file = `layouts/${scene}.json`, layout = JSON.parse(await fs.readFile(file, "utf8"));
  layout.seasonDecor = { x: 50, y: scene === "front" ? 6 : 12, width: 50, height: 12, anchor: [.5, 0], z: 3 };
  await fs.writeFile(file, JSON.stringify(layout, null, 2) + "\n");
}
console.log("Prepared four decorations and their fixed scene slots.");
