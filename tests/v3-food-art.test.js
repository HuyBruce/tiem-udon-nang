import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import manifest from "../assets/manifest.json" with { type: "json" };
import { TOPPINGS } from "../src/data.js";

test("new bowl and topping sprites are mapped and have genuine transparent edges", async () => {
  for (const id of [
    "bowl-empty", "bowl-noodles", "bowl-soup", "bowl-miso", "bowl-curry",
    "bowl-empty-blue", "bowl-noodles-blue", "bowl-soup-blue", "bowl-miso-blue", "bowl-curry-blue",
    "topping-egg", "topping-beef", "topping-tofu", "topping-seaweed",
    ...TOPPINGS.map((id) => `topping-${id}`),
  ]) {
    const asset = manifest.assets[id];
    assert.match(asset.file, /^(sprites|optimized)\/v3-.*\.webp$/);
    if (id.startsWith('topping-')) assert.equal(asset.width, 128);
    const image = sharp(fileURLToPath(new URL(`../assets/${asset.file}`, import.meta.url)));
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
    assert.equal(alpha(0, 0), 0, `${id} top-left`);
    assert.equal(alpha(info.width - 1, info.height - 1), 0, `${id} bottom-right`);
    assert.ok(alpha(Math.floor(info.width / 2), Math.floor(info.height / 2)) > 0, id);
  }
});
