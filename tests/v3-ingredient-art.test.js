import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import manifest from "../assets/manifest.json" with { type: "json" };
import ingredients from "../data/ingredients.json" with { type: "json" };

test("all ingredient icons have independent transparent sprites", async () => {
  for (const id of Object.keys(ingredients)) {
    const asset = manifest.assets[`ingredient-${id}`];
    assert.match(asset.file, new RegExp(`^optimized/v3-ingredient-${id}\\.webp$`));
    const { data, info } = await sharp(`assets/${asset.file}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [128, 128]);
    assert.match(asset.optimizedFrom, /^sprites\/v3-ingredient-/);
    let empty = 0;
    let visible = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (!data[i]) empty++;
      if (data[i] >= 240) visible++;
    }
    assert.ok(empty > info.width * info.height * 0.1, `${id} transparency`);
    assert.ok(visible > info.width * info.height * 0.05, `${id} object`);
    assert.equal(data[3], 0, `${id} top-left`);
  }
});
