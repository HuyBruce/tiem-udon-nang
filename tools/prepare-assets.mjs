import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Import only explicitly generated samples; never makes a paid generation call.
const source = process.argv[2];
if (!source)
  throw new Error(
    "Pass the directory containing the three approved sample outputs.",
  );
const entries = [
  [
    "sample_seating",
    "exec-3e8b8f41-b7b6-43db-b9f9-f87dfe4bf144.png",
    "backgrounds/sample-seating.png",
    false,
  ],
  [
    "sample_kake",
    "exec-675aff20-cb70-427a-99d8-8d058d18db0a.png",
    "sprites/sample-kake.png",
    true,
  ],
  [
    "sample_kettle",
    "exec-65e09ded-9860-4a8a-809c-dae17cb094a8.png",
    "sprites/sample-kettle.png",
    true,
  ],
];
const manifest = { version: 1, status: "sample-awaiting-approval", assets: {} };
for (const [id, input, file, transparent] of entries) {
  await fs.mkdir(path.dirname("assets/" + file), { recursive: true });
  let image = sharp(path.join(source, input));
  if (transparent)
    image = image
      .trim()
      .resize(512, 512, { fit: "contain", background: "#00000000" });
  await image.png().toFile("assets/" + file);
  const meta = await sharp("assets/" + file).metadata();
  const runtimeFile = file.replace(".png", ".webp");
  await sharp("assets/" + file)
    .webp({ quality: 86, alphaQuality: 100 })
    .toFile("assets/" + runtimeFile);
  manifest.assets[id] = {
    file: runtimeFile,
    source: file,
    width: meta.width,
    height: meta.height,
    anchor: transparent ? [0.5, 1] : [0, 0],
    transparent,
    status: "sample",
  };
}
await fs.writeFile(
  "assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await fs.mkdir("docs/review", { recursive: true });
const parts = await Promise.all(
  entries.map(async ([id, , file], i) => ({
    input: await sharp("assets/" + file)
      .resize(350, 525, { fit: "contain", background: "#F6EDD9" })
      .png()
      .toBuffer(),
    left: 20 + i * 370,
    top: 20,
  })),
);
await sharp({
  create: { width: 1130, height: 565, channels: 4, background: "#F6EDD9" },
})
  .composite(parts)
  .png()
  .toFile("docs/review/art-samples.png");
console.log("Prepared 3 samples, manifest and docs/review/art-samples.png.");
