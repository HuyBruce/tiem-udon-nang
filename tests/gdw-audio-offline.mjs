import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch();
const result = {};
try {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:4173/?debug=sound");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await page.locator('[data-sound-play="click"]').tap();
  await expect(page.locator("[data-sound-status]")).toContainText("running");
  result.stats = await page.evaluate(async () => {
    const a = document.querySelector("#app").udonSoundAudio;
    await Promise.all(
      ["morning", "water", "wash", "coin", "bottle", "birds"].map((id) =>
        a.load(id),
      ),
    );
    await a.play("water");
    await a.play("morning", { loop: true, gain: 0.2 });
    return a.stats();
  });
  expect(result.stats.errors).toBe(0);
  expect(result.stats.voices).toBeGreaterThan(0);
  await page.locator("[data-sound-stop]").tap();
  expect(
    await page.evaluate(
      () => document.querySelector("#app").udonSoundAudio.stats().voices,
    ),
  ).toBe(0);
  expect(errors).toEqual([]);
  result.offline = true;
  result.errors = errors;
  const output =
    process.env.GDW_AUDIO_OFFLINE || "review/gdw/step2/offline-audio.json";
  await fs.mkdir(output.substring(0, output.lastIndexOf("/")), {
    recursive: true,
  });
  await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n");
  console.log(
    "PASS: actual production WAV/AAC decoded and played offline; stop clears voices.",
  );
} finally {
  await browser.close();
}
