import test from "node:test";
import assert from "node:assert/strict";
import { AudioSystem } from "../src/systems/audio.js";

test("audio ticks keep automation bounded while volume/mute changes still apply", () => {
  const settings = { music: true, sfx: true, musicVolume: 0.6, sfxVolume: 0.8 };
  const audio = new AudioSystem(settings),
    events = [[], []];
  audio.ctx = { currentTime: 5 };
  [audio.musicBus, audio.sfxBus] = events.map((log) => ({
    gain: {
      value: 1,
      cancelScheduledValues: (t) => log.push(["clear", t]),
      setValueAtTime: (v, t) => log.push(["hold", v, t]),
      setTargetAtTime: (v, t) => log.push(["target", v, t]),
    },
  }));
  for (let i = 0; i < 500; i++) {
    audio.ctx.currentTime++;
    audio.syncSettings();
  }
  assert.deepEqual(
    events.map((e) => e.filter((x) => x[0] === "target").map((x) => x[1])),
    [[0.6], [0.8]],
  );
  settings.music = false;
  audio.syncSettings();
  settings.sfxVolume = 0.3;
  audio.syncSettings();
  settings.music = true;
  audio.syncSettings();
  assert.deepEqual(
    events.map((e) => e.filter((x) => x[0] === "target").map((x) => x[1])),
    [
      [0.6, 0, 0.6],
      [0.8, 0.3],
    ],
  );
});
