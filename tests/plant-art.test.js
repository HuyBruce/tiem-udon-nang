import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import manifest from "../assets/manifest.json" with { type: "json" };
import plantArt from "../data/plant-art.json" with { type: "json" };
import { plantAppearance } from "../src/ui/plant-art.js";
import { PLANTS } from "../src/data.js";

test("garden shows sprout, growing, ripe, and wilted art without changing plant state", () => {
  assert.deepEqual(plantAppearance(null), {
    asset: null,
    phase: "empty",
  });
  for (const id of Object.keys(plantArt)) {
    const plant = { id, growth: 0, dryDays: 0, watered: false };
    assert.equal(plantAppearance(plant).asset, plantArt[id].sprout);
    plant.growth = PLANTS[id].days / 2;
    assert.equal(plantAppearance(plant).phase, "growing");
    if (PLANTS[id].days > 1)
      assert.notEqual(plantArt[id].growing, plantArt[id].ripe);
    plant.growth = PLANTS[id].days;
    assert.equal(plantAppearance(plant).asset, plantArt[id].ripe);
    plant.dryDays = 2;
    assert.equal(plantAppearance(plant).asset, plantArt[id].wilted);
    assert.equal(plant.growth, PLANTS[id].days);
  }
});

test("new garden sprites are registered and have transparent edges", async () => {
  for (const id of Object.values(plantArt).flatMap((stages) =>
    Object.values(stages),
  )) {
    const asset = manifest.assets[id];
    assert.ok(asset, `Missing asset ${id}`);
    const { data, info } = await sharp(`assets/${asset.file}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.ok(info.width > 0 && info.height > 0);
    assert.equal(data[3], 0, `${id}: top-left edge must be transparent`);
    assert.equal(
      data[(info.width - 1) * 4 + 3],
      0,
      `${id}: top-right edge must be transparent`,
    );
  }
});
