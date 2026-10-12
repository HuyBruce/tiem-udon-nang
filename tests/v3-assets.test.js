import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import manifest from "../assets/manifest.json" with { type: "json" };
import art from "../data/character-art.json" with { type: "json" };

test("every registered v3 character frame has real alpha and no green-screen background", async () => {
  for (const [id, frames] of Object.entries(art.expressionFrames))
    for (const frame of frames) {
      const assetId = `v3-${id}${frame === "neutral" ? "" : "-" + frame}`;
      const asset = manifest.assets[assetId];
      assert.ok(asset, `Missing ${assetId}`);
      const file = `assets/${asset.file}`;
      const { data, info } = await sharp(file)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.deepEqual(
        [info.width, info.height],
        id === "owner" ? [512, 768] : [512, 512],
      );
      let empty = 0,
        solid = 0,
        green = 0;
      for (let p = 0; p < data.length; p += 4) {
        if (data[p + 3] === 0) empty++;
        if (data[p + 3] >= 245) solid++;
        if (
          data[p + 3] > 30 &&
          data[p + 1] - Math.max(data[p], data[p + 2]) > 100
        )
          green++;
      }
      const count = info.width * info.height;
      assert.ok(
        empty > count * 0.1 && solid > count * 0.05,
        `${assetId}: expected true transparent background and character`,
      );
      assert.ok(
        green < count * 0.002,
        `${assetId}: green screen residue (${green} pixels)`,
      );
    }
});
