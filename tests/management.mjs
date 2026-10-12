import { chromium, expect } from "@playwright/test";
import { newState } from "../src/systems/state.js";
import { forecast } from "../src/systems/weather.js";
import { marketOffer } from "../src/systems/market.js";
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const fixture = newState();
fixture.day = 12;
fixture.money = 50000;
fixture.reputation = 55;
fixture.forecast = forecast(12);
await page.addInitScript((state) => {
  if (!localStorage.getItem("udon-management-seeded")) {
    localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
    localStorage.setItem("udon-management-seeded", "1");
  }
}, fixture);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("udon-nang-v1")).state);
const click = (act, arg) =>
  page
    .locator(
      `${["dismiss", "upgrade", "decorate", "hire", "quality", "buy", "plant", "garden", "unlock"].includes(act) ? ".sheet " : ""}[data-act="${act}"]${arg !== undefined ? `[data-arg="${arg}"]` : ""}`,
    )
    .click();
const close = async () => {
  if (await page.locator(".close-sheet").count())
    await page.locator(".close-sheet").click();
};
async function panel(id) {
  await page.locator('.bottom-tools [data-arg="manage"]').click();
  await page.locator(`.sheet [data-act="panel"][data-arg="${id}"]`).click();
}
try {
  await page.goto("http://localhost:5173");
  await click("start");
  await close();
  await panel("upgrades");
  await click("upgrade", "seats");
  await expect.poll(async () => (await state()).upgrades.seats).toBe(1);
  await close();
  await expect(
    page.getByRole("button", { name: "Góc cửa sổ 1", exact: true }),
  ).toBeVisible();
  await panel("upgrades");
  await click("upgrade", "stove");
  await expect.poll(async () => (await state()).pots.length).toBe(2);
  await close();
  await panel("decor");
  const decorMoney = (await state()).money;
  await click("preview-decor", "bowl");
  expect((await state()).money).toBe(decorMoney);
  await click("confirm-decor", "bowl");
  await expect.poll(async () => (await state()).decor.bowl).toBe("bowl");
  await close();
  await panel("employees");
  await click("hire", "binh");
  await expect.poll(async () => (await state()).employees.binh?.level).toBe(1);
  await page.locator('[data-staff-option="restock"]').check();
  await expect
    .poll(async () => (await state()).staffOptions.restock)
    .toBe(true);
  await close();
  await panel("inventory");
  await click("quality", "premium");
  const before = (await state()).money;
  const stockPrice = marketOffer(await state(), "noodles", true, 5).price;
  await click("buy", "noodles");
  await expect
    .poll(async () => (await state()).inventory.noodles.some((b) => b.premium))
    .toBe(true);
  expect((await state()).money).toBe(before - stockPrice);
  await close();
  await panel("recipes");
  await click("unlock", "tempura");
  await expect
    .poll(async () => (await state()).unlocked.includes("tempura"))
    .toBe(true);
  await close();
  await panel("menu");
  await page.locator('[data-price="tempura"]').fill("700");
  await page.locator('[data-price="tempura"]').press("Tab");
  await expect.poll(async () => (await state()).prices.tempura).toBe(700);
  await close();
  await click("goto", "garden");
  await page.locator('.stage [data-arg="garden"]').first().click();
  await click("plant", "0:onion");
  await expect.poll(async () => (await state()).plots[0]?.id).toBe("onion");
  await click("garden", "0");
  await expect.poll(async () => (await state()).plots[0]?.watered).toBe(true);
  await close();
  await page.reload();
  await click("start");
  await close();
  expect((await state()).employees.binh.level).toBe(1);
  expect((await state()).decor.bowl).toBe("bowl");
  expect((await state()).plots[0].watered).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/management.png" });
  console.log(
    "PASS: paid expansion adds a scene, stove capacity, decoration, employee permission, premium stock, recipe unlock, price edit, gardening and reload persistence.",
  );
} catch (e) {
  await page.screenshot({ path: "test-results/management-failure.png" });
  throw e;
} finally {
  await browser.close();
}
