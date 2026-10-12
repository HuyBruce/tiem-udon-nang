import { chromium, expect } from "@playwright/test";
const canvasMode = process.env.GDV_RENDERER === "canvas";
const browser = await chromium.launch(
  canvasMode ? { channel: "chromium", args: ["--enable-gpu"] } : {},
);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  deviceScaleFactor: canvasMode ? 3 : 1,
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.error("CONSOLE", m.text());
});
page.on("requestfailed", (r) => console.error("FAILED", r.url(), r.failure()));
try {
  await page.goto(
    "http://localhost:4173/?debug=1" + (canvasMode ? "&renderer=canvas" : ""),
  );
  await page.addStyleTag({
    content: ".debug-tools { display: none !important; }",
  });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Bắt đầu ngày đầu tiên" }).tap();
  await expect(page.locator(".sheet")).toHaveCount(0);
  await page.locator('[data-act="toggle-shop"]').tap();
  await page.locator('.scene-pagination [data-arg="guests0"]').tap();
  await expect(page.locator("h1")).toHaveText("Khu khách");
  if (canvasMode)
    await page.waitForFunction(
      () =>
        document.querySelector(".world-canvas")?.udonRendererStats?.()
          .backend === "webgl",
    );
  await context.setOffline(true);
  await page.reload();
  await page.addStyleTag({
    content: ".debug-tools { display: none !important; }",
  });
  await page.getByRole("button", { name: "Tiếp tục câu chuyện" }).tap();
  await expect(page.locator("h1")).toHaveText("Khu khách");
  await page.getByRole("button", { name: "Căn bếp", exact: true }).tap();
  await expect(page.locator("h1")).toHaveText("Căn bếp");
  if (canvasMode) {
    await page.waitForFunction(
      () =>
        document.querySelector(".world-canvas")?.udonRendererStats?.()
          .backend === "webgl",
    );
    await expect(page.locator(".world-canvas")).toHaveAttribute(
      "data-renderer-ready",
      "true",
    );
  }
  expect(
    await page.evaluate(() =>
      document.fonts.check('400 14px "Be Vietnam Pro"'),
    ),
  ).toBe(true);
  await page.screenshot({
    path: canvasMode
      ? "test-results/canvas-offline.png"
      : "test-results/offline.png",
  });
  expect(errors).toEqual([]);
  console.log(
    "PASS: production PWA starts and restores saved game offline, with local fonts and scene navigation.",
  );
} catch (e) {
  await page.screenshot({ path: "test-results/offline-failure.png" });
  console.error(
    "URL",
    page.url(),
    "BODY",
    await page.locator("body").innerText(),
    "ERRORS",
    errors,
  );
  console.log(
    await page.evaluate(async () => ({
      html: document.documentElement.outerHTML.slice(0, 1600),
      controller: !!navigator.serviceWorker.controller,
      caches: await caches.keys(),
      keys: (await (await caches.open((await caches.keys())[0])).keys()).map(
        (r) => r.url,
      ),
      save: localStorage.getItem("debug-udon-nang-v1")?.slice(0, 300),
    })),
  );
  throw e;
} finally {
  await browser.close();
}
