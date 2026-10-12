import { expect } from "@playwright/test";
export async function chooseWorkOption(page, attribute, value) {
  const selector = attribute.startsWith("[") ? attribute : `[${attribute}]`;
  const trigger = page.locator(selector);
  if (await trigger.evaluate((el) => el.tagName === "SELECT"))
    return trigger.selectOption(value);
  const kind = attribute.replace(/[\[\]]/g, "").replace("data-work-", "");
  await trigger.click();
  await page.locator(`[data-work-option="${kind}:${value}"]`).click();
}

// Preparation is now optional and reached explicitly from management.
export async function openPreparation(page) {
  await page.locator('.bottom-tools [data-arg="manage"]').click();
  await page.locator('.sheet [data-act="panel"][data-arg="morning"]').click();
}

// Historical gameplay tests reach the same detail panels through the stage2 menu.
export async function tapAction(page, act, arg) {
  if (
    act === "open" &&
    !(await page.locator('.sheet [data-act="open"]').count())
  ) {
    await tapAction(page, "goto", "front");
    await page.locator(".door-sign").tap();
    await tapAction(page, "goto", "guests0");
    return;
  }
  if (act === "dismiss" && !(await page.locator(".sheet").count())) return;
  const selector = `[data-act="${act}"]${arg === undefined ? "" : `[data-arg="${arg}"]`}`;
  if (act === "goto") {
    await page.locator(`.scene-pagination ${selector}`).tap();
    await expect(page.locator("#stage")).toHaveAttribute(
      "data-camera-state",
      "idle",
    );
    return;
  }
  const detail = page.locator("[data-work-detail]");
  if (
    act === "pot" &&
    (await detail.count()) &&
    !(await page.locator(selector).count())
  ) {
    await chooseWorkOption(page, "data-work-detail", "cook");
    return;
  }
  if (
    act === "panel" &&
    !(await page.locator(selector).count()) &&
    (await detail.count())
  ) {
    await chooseWorkOption(page, "data-work-detail", arg);
    return;
  }
  const inPanel = page.locator(".sheet").locator(selector);
  await ((await inPanel.count()) ? inPanel : page.locator(selector))
    .filter({ visible: true })
    .first()
    .tap();
}
