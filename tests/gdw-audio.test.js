import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  AudioSystem,
  audioPreferences,
  chooseVariant,
} from "../src/systems/audio.js";
import bank from "../data/audio-events.json" with { type: "json" };
import { pauseReason } from "../src/ui/game-clock.js";
test("audio bank has distinct variants, matching payloads, safe decoded peaks and bounded bytes", () => {
  const report = JSON.parse(
    fs.readFileSync("review/gdw/step2/audio-metrics.json"),
  );
  assert.equal(Object.keys(bank.events).length, 64);
  let bytes = 0;
  for (const e of Object.values(bank.events)) {
    assert.ok(e.label && e.source);
    assert.equal(e.variants.length, e.bus === "music" ? 1 : 3);
    assert.equal(
      new Set(e.variants.map((v) => v.sha256)).size,
      e.variants.length,
    );
    for (const v of e.variants) {
      const b = fs.readFileSync("assets/audio/generated/" + v.file);
      bytes += b.length;
      assert.equal(b.length, v.bytes);
      assert.equal(createHash("sha256").update(b).digest("hex"), v.sha256);
      assert.ok(Number(report.find((r) => r.file === v.file).input_tp) <= -1);
    }
  }
  assert.ok(bytes < 6 * 1024 * 1024, bytes);
  assert.equal(report.length, 186);
});
test("audio options recover malformed input and clamp volume without changing game save", () => {
  assert.deepEqual(audioPreferences(null), {
    version: 1,
    ambient: true,
    ambientVolume: 0.5,
  });
  assert.deepEqual(audioPreferences({ ambient: false, ambientVolume: 5 }), {
    version: 1,
    ambient: false,
    ambientVolume: 1,
  });
  assert.equal(audioPreferences({ ambientVolume: NaN }).ambientVolume, 0.5);
});
test("variant selection never immediately repeats for every previous variant", () => {
  for (let last = 0; last < 3; last++)
    for (let i = 0; i < 100; i++) {
      const next = chooseVariant(3, last, () => i / 100);
      assert.ok(next >= 0 && next < 3);
      assert.notEqual(next, last);
    }
  assert.equal(chooseVariant(1, 0), 0);
  assert.equal(
    chooseVariant(3, -1, () => 0.99),
    2,
  );
});
test("audio credits pause the existing game clock like settings", () => {
  assert.equal(
    pauseReason({ started: true, panel: "audio-info" }),
    "audio-info",
  );
});
test("a fresh gesture resumes an interrupted iOS context and clears the retry notice", async () => {
  const a = new AudioSystem({ music: true, sfx: true });
  let resumes = 0;
  a.ctx = {
    state: "interrupted",
    async resume() {
      resumes++;
      this.state = "running";
    },
  };
  a.unlocked = true;
  a.uiPreloaded = true;
  a.syncSettings = () => {};
  assert.equal(await a.start(), true);
  assert.equal(resumes, 1);
  a.ctx.state = "suspended";
  a.needsTouch = true;
  await a.setHidden(false);
  assert.equal(a.needsTouch, false);
  assert.equal(resumes, 2);
});
