import sharp from "sharp";
import { join } from "node:path";
import job from "../assets/jobs/v3-cold-drinks.json" with { type: "json" };

const base = join(process.cwd(), "assets");
const background = { r: 0, g: 0, b: 0, alpha: 0 };
for (const entry of job.entries) {
  const source = join(base, entry.source);
  if (!(await sharp(source).metadata()).hasAlpha)
    throw new Error(`${entry.id} source lacks alpha`);
  await sharp(source)
    .trim({ background, threshold: 8 })
    .resize(464, 464, { fit: "contain", background })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background })
    .webp({ quality: 86, effort: 6 })
    .toFile(join(base, entry.output));
  console.log(entry.output);
}
