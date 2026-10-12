import fs from "node:fs/promises";
import sharp from "sharp";
const group = process.argv[2] || "a";
const root = "review/gdw/step1";
for (const [w, h] of [
  [375, 667],
  [390, 844],
  [430, 932],
  [440, 956],
  [412, 915],
]) {
  const composites = [];
  for (const [row, folder] of ["before", group].entries())
    for (const [col, scene] of [
      "front",
      "guests0",
      "drinks",
      "kitchen",
      "storage",
      "garden",
    ].entries()) {
      const input = await sharp(`${root}/${folder}/${w}x${h}-${scene}.png`)
        .resize(w, h)
        .png()
        .toBuffer();
      composites.push({ input, left: col * w, top: row * h });
    }
  await sharp({
    create: { width: w * 6, height: h * 2, channels: 3, background: "#f4e8d1" },
  })
    .composite(composites)
    .png()
    .toFile(`${root}/${group}-${w}x${h}-comparison.png`);
}
