import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(process.env.UDON_TEST_BASE_URL || "http://localhost:5173");
  await page.locator("[data-act=start]").click();
  const result = await page.evaluate(async () => {
    const { AudioSystem, AUDIO_EVENTS } = await import("/src/systems/audio.js");
    const a = new AudioSystem({ music: true, sfx: true, haptic: false });
    await a.start();
    const profiles = [];
    for (const [id, e] of Object.entries(AUDIO_EVENTS))
      for (let i = 0; i < e.variants.length; i++) {
        const b = await a.load(id, i);
        if (!b) throw Error("Decode failed " + id + ":" + i);
        const data = b.getChannelData(0);
        let peak = 0,
          power = 0,
          active = 0;
        for (const v of data) {
          peak = Math.max(peak, Math.abs(v));
          power += v * v;
          if (Math.abs(v) > 0.0001) active++;
        }
        const end = Math.min(
          data.length - 1,
          Math.floor(e.variants[i].duration * b.sampleRate) - 1,
        );
        profiles.push({
          id,
          variant: i,
          duration: b.duration,
          peak,
          rms: Math.sqrt(power / data.length),
          active,
          loop: e.loop,
          seam: e.loop ? Math.abs(data[0] - data[end]) : null,
        });
      }
    const s = {
      elapsed: 0,
      forecast: { weather: "rain" },
      burners: [{ stage: "empty" }],
      brothBatch: { stage: "empty" },
      fryer: [],
    };
    a.syncAmbient(s, "front", null);
    await new Promise((r) => setTimeout(r, 200));
    const first = a.ambient;
    for (let i = 0; i < 100; i++) a.syncAmbient(s, "front", null);
    const reused = a.ambient === first;
    s.burners[0].stage = "boiling";
    a.syncAmbient(s, "kitchen", null);
    await new Promise((r) => setTimeout(r, 200));
    const boil = a.loops.get("boil")?.kind;
    const boilVoice = a.loops.get("boil");
    s.burners[0].stage = "heating";
    a.syncAmbient(s, "kitchen", null);
    const heating = {
      sameVoice: a.loops.get("boil") === boilVoice,
      gain: boilVoice?.level,
    };
    a.setWhisking(true);
    a.syncAmbient(s, "drinks", "brew");
    await new Promise((r) => setTimeout(r, 200));
    const whisk = a.loops.get("whisk")?.kind;
    a.setWhisking(false);
    const whiskStopped = !a.loops.has("whisk");
    a.setPreference("ambient", false);
    a.syncAmbient(s, "front", null);
    const muted = !a.loops.has("environment");
    await a.setHidden(true);
    const paused = a.stats();
    await a.dispose();
    return {
      profiles,
      reused,
      boil,
      heating,
      whisk,
      whiskStopped,
      muted,
      paused,
    };
  });
  expect(result.profiles).toHaveLength(186);
  for (const p of result.profiles) {
    expect(p.rms, p.id).toBeGreaterThan(0.0001);
    expect(p.peak, p.id).toBeLessThan(0.8913);
    expect(p.active, p.id).toBeGreaterThan(100);
    if (p.loop) expect(p.seam, p.id).toBeLessThan(0.05);
  }
  expect(result.reused).toBe(true);
  expect(result.boil).toBe("boil");
  expect(result.heating.sameVoice).toBe(true);
  expect(result.heating.gain).toBeLessThan(0.12);
  expect(result.whisk).toBe("whisk");
  expect(result.whiskStopped).toBe(true);
  expect(result.muted).toBe(true);
  expect(result.paused.voices).toBe(0);
  expect(result.paused.state).toBe("suspended");
  const out =
    process.env.GDW_AUDIO_QA || "review/gdw/step2/decoded-metrics.json";
  await fs.mkdir(out.substring(0, out.lastIndexOf("/")), { recursive: true });
  await fs.writeFile(out, JSON.stringify(result, null, 2) + "\n");
  console.log(
    "PASS: 186 actual decoded signals, safe peaks/loop seams, ambient reuse, independent mute and hide cleanup.",
  );
} finally {
  await browser.close();
}
