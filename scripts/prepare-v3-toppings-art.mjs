import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const items = [
  ["ingredient-shiitake", 256],
  ["topping-shiitake", 256],
  ["ingredient-daikon", 256],
  ["topping-daikon", 256],
];

await mkdir("assets/sprites", { recursive: true });
for (const [id, size] of items) {
  const source = `assets/sprites/sources/v3-${id}.png`;
  const output = `assets/sprites/v3-${id}.webp`;
  const cropped = await sharp(source)
    .trim({ background: "#00000000", threshold: 20 })
    .resize(size - 24, size - 24, { fit: "inside" })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, gravity: "center" }])
    .webp({ quality: 88 })
    .toFile(output);
  console.log(`${source} → ${output}`);
}
