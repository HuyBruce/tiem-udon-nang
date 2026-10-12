import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Chroma key for the opaque #00ff00 backgrounds requested by the v3 art brief.
// Flood from the border so isolated green details inside a character survive.
export function chromaKey(data, width, height) {
  const output = Buffer.from(data);
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0,
    tail = 0;
  const visit = (i) => {
    if (seen[i]) return;
    seen[i] = 1;
    const p = i * 4;
    const excess = data[p + 1] - Math.max(data[p], data[p + 2]);
    if (data[p + 1] < 100 || excess <= 45) return;
    queue[tail++] = i;
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (head < tail) {
    const i = queue[head++],
      p = i * 4;
    const excess = data[p + 1] - Math.max(data[p], data[p + 2]);
    const t = Math.min(1, Math.max(0, (excess - 45) / 185));
    const alpha = 1 - t * t * (3 - 2 * t);
    output[p + 3] = Math.round(data[p + 3] * alpha);
    if (alpha > 0 && alpha < 1) {
      // Unmix the known green screen; clamp residual spill at soft edges.
      output[p] = Math.min(255, Math.round(data[p] / alpha));
      output[p + 2] = Math.min(255, Math.round(data[p + 2] / alpha));
      output[p + 1] = Math.max(
        0,
        Math.min(
          255,
          Math.round((data[p + 1] - (1 - alpha) * 255) / alpha),
          Math.max(output[p], output[p + 2]) + 25,
        ),
      );
    } else if (!alpha) output.fill(0, p, p + 4);
    const x = i % width,
      y = Math.floor(i / width);
    if (x) visit(i - 1);
    if (x + 1 < width) visit(i + 1);
    if (y) visit(i - width);
    if (y + 1 < height) visit(i + width);
  }
  // Generated hair, fingers and apron strings can enclose islands of the
  // chroma screen. Remove large high-green islands even when they are not
  // connected to the frame; keep tiny enclosed green details.
  const islandsSeen = new Uint8Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (islandsSeen[start] || !output[start * 4 + 3]) continue;
    const p = start * 4;
    if (data[p + 1] < 100 || data[p + 1] - Math.max(data[p], data[p + 2]) <= 70)
      continue;
    const component = [start];
    islandsSeen[start] = 1;
    for (let head = 0; head < component.length; head++) {
      const i = component[head],
        x = i % width,
        y = Math.floor(i / width);
      for (const j of [
        x ? i - 1 : -1,
        x + 1 < width ? i + 1 : -1,
        y ? i - width : -1,
        y + 1 < height ? i + width : -1,
      ]) {
        if (j < 0 || islandsSeen[j] || !output[j * 4 + 3]) continue;
        const q = j * 4;
        if (
          data[q + 1] < 100 ||
          data[q + 1] - Math.max(data[q], data[q + 2]) <= 70
        )
          continue;
        islandsSeen[j] = 1;
        component.push(j);
      }
    }
    if (component.length > 100)
      for (const i of component) output.fill(0, i * 4, i * 4 + 4);
  }
  return output;
}

export async function removeBackground(input, output, size = 1024) {
  const [targetWidth, targetHeight] = Array.isArray(size) ? size : [size, size];
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = chromaKey(data, info.width, info.height);
  let transparent = 0,
    opaque = 0;
  for (let p = 3; p < pixels.length; p += 4) {
    if (!pixels[p]) transparent++;
    if (pixels[p] === 255) opaque++;
  }
  const total = info.width * info.height;
  if (transparent < total * 0.1 || opaque < total * 0.05)
    throw new Error(
      "Chroma-key validation failed: expected green screen and a solid character.",
    );
  await fs.mkdir(path.dirname(output), { recursive: true });
  // Preserve the frame and eye line. Trimming each expression independently
  // would make characters jump when swapping expressions.
  await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(targetWidth, targetHeight, {
      fit: "contain",
      background: "#00000000",
    })
    .png()
    .toFile(output);
  return {
    width: targetWidth,
    height: targetHeight,
    transparentRatio: transparent / total,
    opaqueRatio: opaque / total,
    anchor: [0.5, 1],
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error("Usage: node tools/remove_bg.mjs input.png output.png");
  console.log(JSON.stringify(await removeBackground(input, output)));
}
