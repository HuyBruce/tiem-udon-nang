import sharp from "sharp";
import job from "../assets/jobs/v3-drink-toppings.json" with { type: "json" };

const background = { r: 0, g: 0, b: 0, alpha: 0 };
for (const e of job.entries) {
  const source = "assets/" + e.source;
  if (!(await sharp(source).metadata()).hasAlpha)
    throw new Error(e.id + " source lacks alpha");
  const size = e.id === "cream" ? 224 : 448;
  const margin = e.id === "cream" ? 16 : 32;
  await sharp(source)
    .trim({ background, threshold: 8 })
    .resize(size, size, { fit: "contain", background })
    .extend({
      top: margin,
      bottom: margin,
      left: margin,
      right: margin,
      background,
    })
    .webp({ quality: 86, effort: 6 })
    .toFile("assets/" + e.output);
  console.log(e.output);
  if (e.id === "iceCream")
    await sharp(source)
      .trim({ background, threshold: 8 })
      .resize(208, 208, { fit: "contain", background })
      .extend({ top: 24, bottom: 24, left: 24, right: 24, background })
      .webp({ quality: 86, effort: 6 })
      .toFile("assets/sprites/v3-ingredient-iceCream.webp");
}
