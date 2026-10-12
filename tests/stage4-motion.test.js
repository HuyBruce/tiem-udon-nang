import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import manifest from "../assets/manifest.json" with { type: "json" };
import balance from "../config/balance.json" with { type: "json" };
import {
  guestFrame,
  guestMood,
  actorFrame,
  phaseFor,
} from "../src/ui/motion/model.js";
import {
  validAnimationAsset,
  sheetFrame,
} from "../src/ui/motion/sprite-sheet.js";

test("stage4: anim manifest metadata, real fallback, reserved sheet budget", () => {
  const entries = Object.entries(manifest.assets).filter(
    ([, a]) => a.type === "anim",
  );
  assert.equal(entries.length, 13);
  for (const [id, a] of entries) {
    assert.ok(validAnimationAsset(a), id);
    assert.ok(fs.existsSync("assets/" + manifest.assets[a.fallback].file), id);
    assert.ok(a.transparent);
    assert.ok(a.maxBytes <= 150 * 1024);
    if (a.status === "ready") assert.ok(fs.existsSync("assets/" + a.file));
  }
  assert.ok(entries.reduce((n, [, a]) => n + a.maxBytes, 0) < 2 * 1024 * 1024);
  const a = entries[0][1];
  for (const change of [
    { frames: 1 },
    { fps: 0 },
    { loop: 1 },
    { frameWidth: 0 },
    { frameHeight: 9999 },
    { file: "../wrong.webp" },
    { status: "fake" },
  ])
    assert.equal(validAnimationAsset({ ...a, ...change }), false);
});
test("stage4: state derived lean, low patience, eating reaction only once, threshold from balance", () => {
  const c = {
    id: "c0",
    seat: 0,
    status: "waiting",
    patience: 100,
    maxPatience: 100,
    arrivalAt: 0,
  };
  assert.equal(guestFrame(c, 3, true).lean, -1.2);
  assert.equal(guestFrame({ ...c, patience: 24 }, 3, true).phase, "restless");
  assert.equal(guestFrame({ ...c, patience: 25 }, 3, true).phase, "waiting");
  assert.equal(
    guestMood({
      happy: true,
      result: { score: balance.quality.excellentThreshold },
    }),
    "happy",
  );
  assert.equal(
    guestMood({
      happy: true,
      result: { score: balance.quality.excellentThreshold - 1 },
    }),
    "neutral",
  );
  assert.equal(
    guestMood({ happy: false, result: { score: 100 } }),
    "disappointed",
  );
  const eating = {
    ...c,
    status: "eating",
    eatTime: balance.customers.eatSeconds - 0.35,
    happy: true,
    result: { score: 100 },
  };
  assert.equal(guestFrame(eating, 3, true).reaction, "happy");
  assert.equal(
    guestFrame(
      { ...eating, eatTime: balance.customers.eatSeconds - 3.15 },
      6,
      true,
    ).reaction,
    "idle",
  );
  assert.ok(guestFrame(eating, 3, true).bob < -3);
  assert.ok(guestFrame({ ...eating, happy: false }, 3, true).lean < 0);
  assert.ok(guestFrame({ ...eating, result: { score: 50 } }, 3, true).lean > 0);
});
test("stage4: stable staggered phases, settings still and no state mutation", () => {
  assert.equal(phaseFor("c0"), phaseFor("c0"));
  assert.ok(Math.abs(phaseFor("c0") - phaseFor("c1")) > 0.1);
  const s = { phase: "open", pet: { sleeping: false } };
  const before = JSON.stringify(s);
  assert.equal(actorFrame("owner", 2, s, true).mode, "working");
  assert.notEqual(
    actorFrame("owner", 2, s, true).transform,
    actorFrame("thu", 2, s, true).transform,
  );
  assert.equal(actorFrame("owner", 2, s, false).transform, "none");
  assert.equal(
    actorFrame("pet-cat", 2, { ...s, pet: { sleeping: true } }, true).mode,
    "sleeping",
  );
  const f = guestFrame(
    { id: "c0", status: "eating", eatTime: 2, seat: 0 },
    5,
    false,
  );
  assert.deepEqual(
    [f.x, f.bob, f.lean, f.shift, f.scaleY, f.bowlLift, f.drinkLift],
    [0, 0, 0, 0, 1, 0, 0],
  );
  assert.equal(JSON.stringify(s), before);
});
test("stage4: frame playback loop, one-shot end and reduced first frame", () => {
  const a = { frames: 6, fps: 8, loop: true };
  assert.equal(sheetFrame(a, 0.26), 2);
  assert.equal(sheetFrame(a, 1), 2);
  assert.equal(sheetFrame({ ...a, loop: false }, 10), 5);
  assert.equal(sheetFrame(a, 10, false), 0);
});
