import sharp from "sharp";
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node tools/preview-on-cream.mjs input output");
const { width, height } = await sharp(input).metadata();
await sharp({ create: { width, height, channels: 4, background: "#f5ebdd" } })
  .composite([{ input }])
  .png()
  .toFile(output);
