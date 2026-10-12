import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch();
const context = await browser.newContext(),
  page = await context.newPage();
try {
  await page.goto("http://localhost:4173");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.locator('[data-act="start"]').click();
  await page.locator('[data-act="toggle-shop"]').click();
  await page.evaluate(async () => {
    const key = (await caches.keys()).find((k) => k.startsWith("udon-nang-"));
    await (
      await caches.open(key)
    ).put(
      "/",
      new Response("<!doctype html><html><body>OLD BUILD</body></html>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
  });
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("udon-nang-v1")).state,
  );
  await page.reload();
  await expect(page.locator('[data-act="start"]')).toContainText("Tiếp tục");
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("udon-nang-v1")).state,
  );
  expect(after.money).toBe(before.money);
  expect(after.day).toBe(before.day);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-act="start"]')).toContainText("Tiếp tục");
  console.log(
    "PASS: online reload replaces deliberately stale cached HTML, keeps save, then loads fresh shell offline.",
  );
} finally {
  await browser.close();
}
