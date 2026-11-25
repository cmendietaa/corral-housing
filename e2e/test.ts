import { test as base } from "@playwright/test";

export { expect, type Page } from "@playwright/test";

/** A stand-in photo for Street View in every test. */
export const STREET_IMAGE = "docs/screenshots/board.png";

/**
 * Every test answers Street View with a stand-in image, so test runs never
 * call Google (or spend the app's per-visitor photo limit). A test can still
 * add its own route: the newest route wins.
 */
export const test = base.extend<{ stubStreetView: void }>({
  stubStreetView: [
    async ({ page }, use) => {
      await page.route("**/api/streetview?**", (r) => r.fulfill({ path: STREET_IMAGE, contentType: "image/png" }));
      await page.route("**/api/streetview/date?**", (r) => r.fulfill({ json: { date: null } }));
      await use();
    },
    { auto: true }
  ]
});
