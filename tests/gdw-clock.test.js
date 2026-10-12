import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import {
  interpolatedMinutes,
  pauseReason,
  returnSeconds,
} from "../src/ui/game-clock.js";
import { gameMinutes } from "../src/systems/time.js";
test("five real minutes produce exactly five game hours, including a closed shop", () => {
  const e = new Engine();
  e.open();
  e.close();
  const start = gameMinutes(e.s);
  for (let i = 0; i < 1200; i++) e.tick(0.25);
  assert.equal(gameMinutes(e.s) - start, 300);
  assert.equal(e.s.phase, "open");
});
test("clock interpolates continuously but freezes for explicit pause", () => {
  const e = new Engine();
  e.open();
  assert.equal(interpolatedMinutes(e.s, 125, 0, ""), gameMinutes(e.s) + 0.125);
  assert.equal(interpolatedMinutes(e.s, 125, 0, "settings"), gameMinutes(e.s));
  assert.equal(pauseReason({ started: true, panel: "order" }), "");
  assert.equal(pauseReason({ started: true, panel: "recipes" }), "recipes");
  assert.equal(pauseReason({ started: true }, true), "hidden");
});
test("background catch-up caps at two seconds and never moves backwards", () => {
  assert.equal(returnSeconds(300000), 2);
  assert.equal(returnSeconds(800), 0.8);
  assert.equal(returnSeconds(-500), 0);
});
