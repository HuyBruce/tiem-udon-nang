import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch();
const svg = await fs.readFile("public/icon.svg", "utf8");
for (const size of [192, 512]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  await page.setContent(
    `<style>body{margin:0}svg{width:100vw;height:100vh}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icon-${size}.png` });
  await page.close();
}
await browser.close();
