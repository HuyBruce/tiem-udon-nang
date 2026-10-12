import sharp from "sharp";

const stages = ["sprout", "growing", "ripe", "wilted"];
const sheetCuts = {
  onion: [0, 535, 1066, 1638, 2172],
  flowers: [0, 476, 980, 1614, 2172],
  yuzu: [0, 408, 954, 1650, 2172],
};
for (const crop of ["onion", "flowers", "yuzu"]) {
  const source = `assets/sprites/sources/v4-garden-${crop}-sheet.png`;
  const meta = await sharp(source).metadata();
  if (meta.width !== 2172 || meta.height !== 724 || !meta.hasAlpha)
    throw new Error(`Unexpected sprite sheet geometry: ${source}`);
  for (const [i, stage] of stages.entries()) {
    const left = sheetCuts[crop][i];
    const width = sheetCuts[crop][i + 1] - left;
    const frame = await sharp(source)
      .extract({ left, top: 0, width, height: 700 })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: 720,
        height: 700,
        channels: 4,
        background: "#00000000",
      },
    })
      .composite([
        { input: frame, left: Math.round((720 - width) / 2), top: 0 },
      ])
      .webp({ quality: 88 })
      .toFile(`assets/sprites/v4-garden-${crop}-${stage}.webp`);
  }
}

const bedSource = "assets/sprites/sources/v4-garden-bed.png";
const { data, info } = await sharp(bedSource)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let left = info.width;
let right = 0;
let top = info.height;
let bottom = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels + 3] <= 8) continue;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
}
const margin = 16;
left = Math.max(0, left - margin);
right = Math.min(info.width - 1, right + margin);
top = Math.max(0, top - margin);
bottom = Math.min(info.height - 1, bottom + margin);
await sharp(bedSource)
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .resize({ width: 1024 })
  .webp({ quality: 88 })
  .toFile("assets/sprites/v4-garden-bed.webp");

await sharp("assets/backgrounds/sources/v4-garden-field.png")
  .webp({ quality: 86 })
  .toFile("assets/backgrounds/v4-garden-field.webp");

console.log("Prepared field background, soil bed and 12 crop stage sprites.");
