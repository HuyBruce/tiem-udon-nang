import test from "node:test";
import assert from "node:assert/strict";
import { workstationFocus } from "../src/ui/workstation-focus.js";
import { newState } from "../src/systems/state.js";
import { projectY, roomBands } from "../src/ui/room-composition.js";
test("work focus follows the lifted dish and chosen tool without mutating game state", () => {
  const s = newState(),
    before = JSON.stringify(s);
  assert.equal(workstationFocus(s, "drinks"), "cup");
  assert.equal(workstationFocus(s, "kitchen", 0, "broth"), "broth");
  assert.equal(workstationFocus(s, "kitchen", 0, "fryer"), "fryer");
  assert.equal(workstationFocus(s, "kitchen"), "pot");
  assert.equal(workstationFocus(s, "garden"), null);
  assert.equal(JSON.stringify(s), before);
  s.pots[0] = { lifted: true };
  assert.equal(workstationFocus(s, "kitchen", 0, "broth"), "bowl");
});
test("room projection keeps measured counters aligned at every band and short viewport", () => {
  for (const h of [640, 844, 932]) {
    for (const scene of [
      "front",
      "guests0",
      "guests3",
      "drinks",
      "kitchen",
      "storage",
    ]) {
      const b = roomBands(scene, h);
      assert.equal(projectY(scene, b.source[1], h), b.target[1]);
      assert.equal(projectY(scene, 0, h), b.target[0]);
      assert.equal(projectY(scene, 100, h), 100);
      for (let i = 1; i < 100; i++)
        assert.ok(projectY(scene, i, h) > projectY(scene, i - 1, h));
      for (const cut of b.source.slice(1, -1))
        assert.ok(
          Math.abs(
            projectY(scene, cut + 0.001, h) - projectY(scene, cut - 0.001, h),
          ) < 0.01,
        );
    }
  }
  assert.equal(roomBands("garden"), null);
  assert.equal(projectY("garden", 62, 640), 62);
});
test("short workstation shelves reserve HUD space without changing the shared counter", () => {
  for (const scene of ["drinks", "kitchen"]) {
    assert.equal((projectY(scene, 0, 640) * 640) / 100, 43);
    const b = roomBands(scene, 640);
    assert.equal(projectY(scene, b.source[1], 640), 58);
    assert.ok(roomBands(scene, 844).target[0] > 0);
  }
  assert.equal(roomBands("guests0", 640).target[0], 0);
});
test("tall screen puts extra height in the wall and keeps counter pixels stable", () => {
  const low = roomBands("kitchen", 844, 390);
  const high = roomBands("kitchen", 932, 390);
  assert.equal(high.extra - low.extra, 88);
  assert.ok(
    Math.abs(
      ((high.target[2] - high.target[1]) * 932) / 100 -
        ((low.target[2] - low.target[1]) * 844) / 100,
    ) < 1e-9,
  );
});
