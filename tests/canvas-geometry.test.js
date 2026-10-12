import test from "node:test";
import assert from "node:assert/strict";
import {
  fitImage,
  stackingOrder,
  overlaps,
} from "../src/ui/renderer/canvas-model.js";

test("canvas uses contain/cover and bottom pivot without stretching sprite art", () => {
  const box = { x: 10, y: 20, width: 100, height: 100 },
    natural = { width: 200, height: 100 };
  assert.deepEqual(fitImage(box, natural), {
    x: 10,
    y: 45,
    width: 100,
    height: 50,
  });
  assert.deepEqual(fitImage(box, natural, "contain", [0.5, 1]), {
    x: 10,
    y: 70,
    width: 100,
    height: 50,
  });
  assert.deepEqual(fitImage(box, natural, "cover"), {
    x: -40,
    y: 20,
    width: 200,
    height: 100,
  });
  assert.deepEqual(fitImage(box, natural, "fill"), box);
});
test("canvas keeps stacking contexts and excludes objects only touching viewport edges", () => {
  assert.ok(
    stackingOrder({ stack: [1, 20], order: 10 }, { stack: [3, 0], order: 0 }) <
      0,
  );
  assert.equal(
    stackingOrder({ stack: [3], order: 2 }, { stack: [3], order: 4 }),
    -2,
  );
  assert.equal(
    overlaps(
      { x: 100, y: 0, width: 50, height: 50 },
      { x: 0, y: 0, width: 100, height: 100 },
    ),
    false,
  );
  assert.equal(
    overlaps(
      { x: 99, y: 0, width: 50, height: 50 },
      { x: 0, y: 0, width: 100, height: 100 },
    ),
    true,
  );
});
