import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { Engine } from "../src/systems/engine.js";

const output =
  process.env.PERF_MOTION_OUTPUT || "test-results/perf-motion-writes";
const e = new Engine();
e.s.money = 200000;
e.s.tasteSeed = 123456;
for (let i = 0; i < 3; i++) e.upgrade("seats");
e.hire("thu");
e.hire("mika");
e.adoptPet("cat");
e.open();
for (let i = 1; i < 8; i++) e.spawn();
e.s.nextArrival = 1000;
e.tick(2);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript(
    (s) =>
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state: s })),
    e.s,
  );
  await page.goto(
    (process.env.UDON_TEST_BASE_URL || "http://localhost:5173") + "/?debug=1",
  );
  await page.locator("[data-act=start]").click();
  await page.locator(".scene-pagination [data-arg=guests0]").click();
  await page.waitForFunction(
    () => document.querySelector("#stage")?.dataset.visibleRooms === "guests0",
  );
  await page.waitForTimeout(500);
  const result = await page.evaluate(async () => {
    const records = [],
      samples = new Set();
    const observer = new MutationObserver((r) => records.push(...r));
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [
        "data-motion",
        "data-reaction",
        "data-motion-state",
        "data-motion-paused",
        "data-motion-running",
        "data-guest-motion",
        "data-urgency",
        "aria-valuenow",
      ],
    });
    const timer = setInterval(
      () =>
        samples.add(
          document.querySelector(".customer > .sprite")?.style.transform,
        ),
      50,
    );
    await new Promise((r) => setTimeout(r, 1500));
    clearInterval(timer);
    records.push(...observer.takeRecords());
    observer.disconnect();
    const next = new Map(),
      counts = {};
    for (let i = records.length - 1; i >= 0; i--) {
      const r = records[i];
      if (!next.has(r.target)) next.set(r.target, new Map());
      const values = next.get(r.target);
      const after = values.has(r.attributeName)
        ? values.get(r.attributeName)
        : r.target.getAttribute(r.attributeName);
      counts[r.attributeName] ||= { total: 0, unchanged: 0 };
      counts[r.attributeName].total++;
      if (r.oldValue === after) counts[r.attributeName].unchanged++;
      values.set(r.attributeName, r.oldValue);
    }
    return { counts, distinctPoses: samples.size };
  });
  for (const count of Object.values(result.counts))
    expect(count.unchanged).toBe(0);
  expect(result.distinctPoses).toBeGreaterThan(5);
  await page.locator('.hud [data-act="panel"][data-arg="settings"]').click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-motion-paused",
    "true",
  );
  await page.locator(".close-sheet").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-motion-paused",
    "false",
  );
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(output + "/metrics.json", JSON.stringify(result, null, 2));
  console.log(
    "Motion metadata avoids duplicate mutations; animated poses and pause/resume PASS",
    result,
  );
} finally {
  await browser.close();
}
