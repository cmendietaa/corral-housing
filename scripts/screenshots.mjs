// Captures the README screenshots from a running Corral (dev server by default).
//   node scripts/screenshots.mjs [baseUrl]
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "docs/screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const settle = (page, ms = 3500) => page.waitForTimeout(ms);

// Desktop
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/`);
  await settle(page, 1500);
  await page.screenshot({ path: `${out}/landing.png` });

  await page.goto(`${base}/demo`);
  await settle(page, 7000); // map tiles
  await page.screenshot({ path: `${out}/board.png` });

  await page.getByRole("button", { name: "Status", exact: true }).filter({ visible: true }).first().click();
  await settle(page, 1500);
  await page.screenshot({ path: `${out}/status.png` });

  await page.getByRole("button", { name: "Map", exact: true }).filter({ visible: true }).first().click();
  await settle(page, 1500);
  for (const name of ["Sabado Tarde, 6512", "Trigo Rd, 6545", "Calle Real, 7150"]) {
    await page.getByRole("checkbox", { name: `Compare ${name}` }).click();
  }
  await page.getByRole("button", { name: "Compare", exact: true }).filter({ visible: true }).click();
  await settle(page, 1500);
  await page.screenshot({ path: `${out}/compare.png`, fullPage: true });
  await page.close();
}

// Phone
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto(`${base}/demo`);
  await settle(page, 2500);
  await page.screenshot({ path: `${out}/phone-list.png` });
  await page.getByRole("button", { name: "Sabado Tarde, 6512", exact: true }).click();
  await settle(page, 1500);
  await page.screenshot({ path: `${out}/phone-sheet.png` });
  await ctx.close();
}

await browser.close();
console.log(`Saved screenshots to ${out}/`);
