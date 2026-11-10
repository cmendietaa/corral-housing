import { expect, test, type Page } from "@playwright/test";

/**
 * Demo tour photos: kept in this browser (IndexedDB), never uploaded.
 * Uses a large PNG so the in-browser shrink step really runs.
 */

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;
const IMAGE = "docs/screenshots/board.png";

async function placeScope(page: Page) {
  await page.route("**/api/geocode?**", (r) => r.fulfill({ json: { lat: 34.411, lng: -119.8575 } }));
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Our place by the bluffs" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Trigo Rd, 6545", exact: true }).click();
  return isPhone(page) ? page.getByRole("dialog") : page.getByRole("region", { name: "Selected place: Trigo Rd, 6545" });
}

test("add a tour photo, see it on the place, keep it after reload, then remove it", async ({ page }) => {
  let scope = await placeScope(page);
  await scope.getByLabel("Add tour photos of Trigo Rd, 6545").setInputFiles(IMAGE);
  const strip = scope.getByRole("region", { name: "Tour photos of Trigo Rd, 6545" });
  await expect(strip.getByRole("button", { name: "Open tour photo 1 of 1" })).toBeVisible();
  await expect(scope.getByAltText("Tour photo of Trigo Rd, 6545")).toBeVisible();

  // The shrunk photo is a JPEG no wider than 1600px.
  const width = await strip.locator("img").first().evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(width).toBeLessThanOrEqual(1600);

  await page.reload();
  scope = await placeScope(page);
  await expect(scope.getByRole("button", { name: "Open tour photo 1 of 1" })).toBeVisible();

  await scope.getByRole("button", { name: "Open tour photo 1 of 1" }).click();
  const viewer = page.getByRole("dialog", { name: "Tour photos of Trigo Rd, 6545" });
  await expect(viewer.getByText(/Photo 1 of 1/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await viewer.getByRole("button", { name: "Remove" }).click();
  await expect(viewer).toBeHidden();
  await expect(scope.getByRole("button", { name: /Open tour photo/ })).toHaveCount(0);
  await expect(scope.getByRole("button", { name: /Add photos from your tour/ })).toBeVisible();
});
