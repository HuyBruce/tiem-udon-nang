import test from "node:test";
import assert from "node:assert/strict";
import { characterAsset } from "../src/ui/character-expression.js";

test("all guests and staff use expression sprites without changing identity", () => {
  for (const id of ["an", "mai", "ha", "son", "linh", "ken", "vip"]) {
    assert.equal(
      characterAsset({ personId: id, status: "waiting" }),
      `v3-${id}`,
    );
    assert.equal(
      characterAsset({ personId: id, status: "waiting", accepted: true }),
      `v3-${id}-thinking`,
    );
    assert.equal(
      characterAsset({ personId: id, status: "waiting", hints: 3 }),
      `v3-${id}-angry`,
    );
    assert.equal(
      characterAsset({ personId: id, happy: true, result: { score: 78 } }),
      `v3-${id}-happy`,
    );
    assert.equal(
      characterAsset({ personId: id, happy: true, result: { score: 92 } }),
      `v3-${id}-very-happy`,
    );
    assert.equal(
      characterAsset({ personId: id, happy: false, result: { score: 60 } }),
      `v3-${id}-sad`,
    );
    assert.equal(
      characterAsset({ personId: id, happy: false, result: { score: 40 } }),
      `v3-${id}-angry`,
    );
  }
  assert.equal(
    characterAsset({ personId: "thu", expression: "thinking" }),
    "v3-thu-thinking",
  );
  assert.equal(
    characterAsset({ personId: "owner", expression: "happy" }),
    "v3-owner-happy",
  );
});
