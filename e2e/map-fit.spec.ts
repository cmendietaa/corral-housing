import { expect, test, type Page } from "@playwright/test";

/**
 * The map opens with every open place in IV in view: not off the edge and not
 * hidden under the place card (desktop) or the mini card (phones). Regression
 * test for the first "bring the selected pin into view" undoing the first fit.
 */

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

test("open places in the main cluster are all in view on the map", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Our place by the bluffs" }).first()).toBeVisible();
  if (isPhone(page)) await page.getByRole("group", { name: "View" }).filter({ visible: true }).getByRole("button", { name: "Map" }).click();
  await page.waitForTimeout(2500); // the map settles after the first fit

  const map = (await page.locator(".maplibregl-map").boundingBox())!;
  const card = isPhone(page)
    ? (await page.getByRole("button", { name: /Sabado Tarde, 6512/ }).filter({ visible: true }).last().boundingBox())!
    : (await page.locator("section[aria-label='Map of places'] .no-scrollbar").first().boundingBox())!;

  // The four open IV places (the Goleta one is behind "Show all places").
  for (const tag of ["$5.4k", "$7.2k", "$4.8k", "$?"]) {
    const pin = (await page.locator(".maplibregl-marker", { hasText: tag }).boundingBox())!;
    expect(pin.x, `${tag} left edge`).toBeGreaterThanOrEqual(map.x);
    expect(pin.x + pin.width, `${tag} right edge`).toBeLessThanOrEqual(map.x + map.width);
    expect(pin.y, `${tag} top edge`).toBeGreaterThanOrEqual(map.y);
    const overlapsCard =
      pin.x < card.x + card.width && pin.x + pin.width > card.x && pin.y < card.y + card.height && pin.y + pin.height > card.y;
    expect(overlapsCard, `${tag} under the card`).toBe(false);
  }
});
