import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { format } from "prettier";
const manifest = JSON.parse(await fs.readFile("assets/manifest.json", "utf8"));
const report = [];
for (const [id, asset] of Object.entries(manifest.assets)) {
  const small =
    (id.startsWith("ingredient-") || id.startsWith("topping-")) &&
    (asset.width === 256 || asset.optimizedFrom);
  const foliage = id.startsWith("gdv-fg-");
  if (!small && !foliage) continue;
  const original = asset.optimizedFrom || asset.file;
  const file = `optimized/${path.basename(original)}`;
  await fs.mkdir("assets/optimized", { recursive: true });
  await sharp(`assets/${original}`)
    .resize({ width: small ? 128 : 900 })
    .webp({ quality: 86, alphaQuality: 100, effort: 6 })
    .toFile(`assets/${file}`);
  const meta = await sharp(`assets/${file}`).metadata();
  report.push({
    id,
    original,
    file,
    width: meta.width,
    height: meta.height,
    beforeBytes: (await fs.stat(`assets/${original}`)).size,
    afterBytes: (await fs.stat(`assets/${file}`)).size,
  });
  asset.optimizedFrom = original;
  asset.file = file;
  asset.width = meta.width;
  asset.height = meta.height;
}
await fs.writeFile(
  "assets/manifest.json",
  await format(JSON.stringify(manifest), { parser: "json" }),
);
await fs.mkdir("review/gdv/step3", { recursive: true });
await fs.writeFile(
  "review/gdv/step3/asset-optimization.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    count: report.length,
    before: report.reduce((n, a) => n + a.beforeBytes, 0),
    after: report.reduce((n, a) => n + a.afterBytes, 0),
  }),
);
