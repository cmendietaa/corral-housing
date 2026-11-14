// Renders the fictional sample screenshot(s) to JPEG with Playwright's Chromium.
//   node scripts/screenshots/render.mjs
// Phone-sized (390 CSS px wide at 2x), like a real phone screenshot.
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const jobs = [{ html: "scripts/screenshots/sample-post.html", out: "public/samples/listing-screenshot.jpg" }];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const job of jobs) {
  await page.goto(new URL(job.html, root).href);
  await page.screenshot({ path: fileURLToPath(new URL(job.out, root)), type: "jpeg", quality: 85, fullPage: true });
  console.log(`wrote ${job.out}`);
}
await browser.close();
