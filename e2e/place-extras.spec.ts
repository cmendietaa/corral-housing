import { expect, test, type Page } from "./test";

/** Notes on a place, photos added with a new place, and choosing which photo leads. */

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;
const IMAGE = "docs/screenshots/board.png";

async function openDemo(page: Page) {
  await page.route("**/api/geocode?**", (r) => r.fulfill({ json: { lat: 34.411, lng: -119.8575 } }));
  // Street View answers with a stand-in image, so the test doesn't call Google.
  await page.route("**/api/streetview?**", (r) => r.fulfill({ path: IMAGE, contentType: "image/png" }));
  await page.route("**/api/streetview/date?**", (r) => r.fulfill({ json: { date: null } }));
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Our place by the bluffs" }).first()).toBeVisible();
}

async function openPlace(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  return isPhone(page) ? page.getByRole("dialog", { name }) : page.getByRole("region", { name: `Selected place: ${name}` });
}

test("a place's notes show on it and can be edited there", async ({ page }) => {
  await openDemo(page);
  let place = await openPlace(page, "Trigo Rd, 6545");
  const notes = place.getByRole("region", { name: "Notes on Trigo Rd, 6545" });
  await expect(notes).toContainText("call for price");

  await notes.getByRole("button", { name: "Edit notes on Trigo Rd, 6545" }).click();
  await place.getByLabel("Notes").fill("Landlord picks up after 5pm.\nAsk about the garage.");
  await place.getByRole("button", { name: "Save notes" }).click();
  await expect(notes).toContainText("Ask about the garage.");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Our place by the bluffs" }).first()).toBeVisible();
  place = await openPlace(page, "Trigo Rd, 6545");
  await expect(place.getByRole("region", { name: "Notes on Trigo Rd, 6545" })).toContainText("Landlord picks up after 5pm.");
});

test("photos picked while adding a place are on it once it's added", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Add a place" }).filter({ visible: true }).first().click();
  const form = page.getByRole("dialog", { name: "Add a place" });
  await form.getByRole("button", { name: /Fill it in by hand/ }).click();
  await form.getByLabel(/^Name/).fill("Garden cottage");
  await form.getByLabel("Address").fill("6600 Picasso Rd, Isla Vista");
  await form.getByLabel("Add photos of this place").setInputFiles(IMAGE);
  await expect(form.getByAltText("Photo 1 to add")).toBeVisible();
  await form.getByRole("button", { name: "Into the corral" }).click();
  await expect(form).toBeHidden();

  const place = isPhone(page)
    ? await openPlace(page, "Picasso Rd, 6600")
    : page.getByRole("region", { name: "Selected place: Picasso Rd, 6600" });
  const strip = place.getByRole("region", { name: "Photos of Picasso Rd, 6600" });
  await expect(strip.getByRole("button", { name: "Open photo 1 of 1 (cover)" })).toBeVisible();
});

test("the group can keep Street View as the cover, or hide it", async ({ page }) => {
  await openDemo(page);
  const place = await openPlace(page, "Trigo Rd, 6545");
  const strip = place.getByRole("region", { name: "Photos of Trigo Rd, 6545" });
  const street = strip.getByRole("button", { name: /^Open Street View/ });
  await expect(strip).toBeVisible();
  test.skip((await street.count()) === 0, "Street View isn't configured on this server");

  // Adding a photo makes it the cover; Street View stays in the strip.
  await place.getByLabel("Add photos of Trigo Rd, 6545").setInputFiles(IMAGE);
  await expect(strip.getByRole("button", { name: "Open photo 1 of 1 (cover)" })).toBeVisible();
  await expect(street).toHaveAccessibleName("Open Street View");

  // Make Street View the cover again.
  await street.click();
  const viewer = page.getByRole("dialog", { name: "Photos of Trigo Rd, 6545" });
  await viewer.getByRole("button", { name: "Make cover" }).click();
  await expect(viewer.getByText("Cover photo")).toBeVisible();
  await viewer.getByRole("button", { name: "Close photos" }).click();
  await expect(street).toHaveAccessibleName("Open Street View (cover)");

  // Hide it: the photo leads, and Street View can come back.
  await street.click();
  await viewer.getByRole("button", { name: "Hide Street View" }).click();
  await viewer.getByRole("button", { name: "Close photos" }).click();
  await expect(strip.getByRole("button", { name: /^Open Street View/ })).toHaveCount(0);
  await expect(strip.getByRole("button", { name: "Open photo 1 of 1 (cover)" })).toBeVisible();
  await strip.getByRole("button", { name: "Show Street View" }).click();
  await expect(strip.getByRole("button", { name: "Open Street View" })).toBeVisible();
});
