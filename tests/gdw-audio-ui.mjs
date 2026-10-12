import { chromium, webkit, expect } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
import { tapAction } from "./ui-actions.mjs";
const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173",
  out = process.env.GDW_AUDIO_SHOTS || "review/gdw/step2/ui";
await fs.mkdir(out, { recursive: true });
const results = [];
async function settlePanel(page) {
  await page.locator(".sheet").evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations({ subtree: true })
        .filter((a) => Number.isFinite(a.effect.getComputedTiming().iterations))
        .map((a) => a.finished.catch(() => {})),
    );
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
}
for (const [engine, sizes] of [
  [
    webkit,
    [
      [375, 667],
      [390, 844],
      [430, 932],
      [440, 956],
      [412, 915],
    ],
  ],
  [chromium, [[390, 844]]],
]) {
  const browser = await engine.launch();
  try {
    for (const [width, height] of sizes) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + "/?debug=sound");
      await expect(page.locator(".sound-row")).toHaveCount(64);
      await page.locator('[data-sound-play="click"]').tap();
      const webAudio = await page.evaluate(() =>
        Boolean(window.AudioContext || window.webkitAudioContext),
      );
      await expect(page.locator("[data-sound-status]")).toContainText(
        webAudio ? "running" : "chưa hỗ trợ",
      );
      const decoded = await page.evaluate(async () => {
        const a = document.querySelector("#app").udonSoundAudio;
        await a.load("morning");
        await a.load("wash");
        return a.stats();
      });
      expect(decoded.errors).toBe(0);
      if (webAudio) expect(decoded.buffers).toBeGreaterThan(1);
      await page.locator('[data-sound-feedback="click:heard"]').check();
      await page
        .locator('[data-sound-feedback="click:note"]')
        .fill("Âm thử tiếng Việt");
      await page.reload();
      await expect(
        page.locator('[data-sound-feedback="click:heard"]'),
      ).toBeChecked();
      await expect(
        page.locator('[data-sound-feedback="click:note"]'),
      ).toHaveValue("Âm thử tiếng Việt");
      await page.locator('[data-sound-play="click"]').tap();
      const stats = webAudio
        ? await page.evaluate(async () => {
            const a = document.querySelector("#app").udonSoundAudio;
            await Promise.all(
              ["click", "coin", "wash", "morning"].flatMap((id) =>
                [0, 1, 2]
                  .filter((i) => i < (id === "morning" ? 1 : 3))
                  .map((i) => a.load(id, i)),
              ),
            );
            const history = [],
              latencies = [];
            for (let i = 0; i < 32; i++) {
              const t = performance.now();
              await a.play("click");
              latencies.push(performance.now() - t);
              history.push(a.eventsPlayed.at(-1).index);
            }
            for (let i = 0; i < 80; i++) await a.play("coin");
            const burst = a.stats();
            a.stopAll();
            await a.setHidden(true);
            const paused = a.stats();
            await a.setHidden(false);
            latencies.sort((x, y) => x - y);
            return {
              history,
              burst,
              paused,
              resumed: a.stats(),
              warmP95Ms: latencies[Math.floor(latencies.length * 0.95)],
            };
          })
        : null;
      if (webAudio) {
        for (let i = 1; i < stats.history.length; i++)
          expect(stats.history[i]).not.toBe(stats.history[i - 1]);
        expect(stats.burst.voices).toBeLessThanOrEqual(24);
        expect(stats.paused.voices).toBe(0);
        expect(stats.paused.state).toBe("suspended");
        expect(stats.resumed.state).toBe("running");
        expect(stats.warmP95Ms).toBeLessThan(50);
      }
      await page.locator("[data-sound-stop]").tap();
      await page.evaluate(
        () => (document.querySelector(".sound-lab").scrollTop = 0),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const name = `${engine === webkit ? "webkit" : "chromium"}-${width}x${height}`;
      await page.screenshot({ path: `${out}/${name}.png` });
      await page.goto(base);
      await tapAction(page, "start");
      await tapAction(page, "panel", "settings");
      await page.locator('[data-audio-setting="ambient"]').uncheck();
      await page.locator('[data-audio-setting="ambientVolume"]').fill("0.3");
      await page
        .locator('[data-audio-setting="ambientVolume"]')
        .dispatchEvent("change");
      await expect(
        page.locator('[data-audio-setting="ambient"] + .toggle'),
      ).toBeVisible();
      await settlePanel(page);
      await page.screenshot({ path: `${out}/${name}-settings.png` });
      await page.reload();
      await tapAction(page, "start");
      await tapAction(page, "panel", "settings");
      await expect(
        page.locator('[data-audio-setting="ambient"]'),
      ).not.toBeChecked();
      await expect(
        page.locator('[data-audio-setting="ambientVolume"]'),
      ).toHaveValue("0.3");
      await tapAction(page, "panel", "audio-info");
      await expect(page.locator(".sheet")).toContainText("Kenney");
      await settlePanel(page);
      const creditsShot = await page.screenshot();
      await fs.writeFile(`${out}/${name}-credits.png`, creditsShot);
      const creditsScale = (await sharp(creditsShot).metadata()).width / width;
      for (const button of [".back-sheet", ".close-sheet"]) {
        const rect = await page
          .locator(`.sheet ${button} .ui-icon`)
          .boundingBox();
        const pixels = await sharp(creditsShot)
          .extract({
            left: Math.round(rect.x * creditsScale),
            top: Math.round(rect.y * creditsScale),
            width: Math.floor(rect.width * creditsScale),
            height: Math.floor(rect.height * creditsScale),
          })
          .removeAlpha()
          .raw()
          .toBuffer();
        let ink = 0;
        for (let i = 0; i < pixels.length; i += 3)
          if (pixels[i] > 210 && pixels[i + 1] > 210 && pixels[i + 2] > 190)
            ink++;
        expect(
          ink,
          `${name} ${button}: visible credits navigation ink`,
        ).toBeGreaterThan(5);
      }
      await page.locator('.sheet .back-sheet[data-act="panel-back"]').tap();
      await expect(page.locator('.sheet[data-panel="settings"]')).toBeVisible();
      expect(errors).toEqual([]);
      results.push({
        engine: engine === webkit ? "webkit" : "chromium",
        width,
        height,
        webAudio,
        decoded,
        stats,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
await fs.writeFile(
  out + "/metrics.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(
  "PASS: six sound-review UI runs; real Chromium WAV/AAC, variants, pool/hide/resume. Windows WebKit lacks Web Audio: UI-only, not audio acceptance.",
);
