import sharp from "sharp";

for (const file of process.argv.slice(2)) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let empty = 0;
  let solid = 0;
  const bins = [0, 0, 0, 0, 0];
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) empty++;
    if (data[i] === 255) solid++;
    bins[Math.min(4, Math.floor(data[i] / 51))]++;
  }
  const count = info.width * info.height;
  console.log(`${file}: transparent ${(empty / count * 100).toFixed(1)}%, solid ${(solid / count * 100).toFixed(1)}%, alpha bins ${bins.map((n) => (n / count * 100).toFixed(1)).join("/")}`);
}
