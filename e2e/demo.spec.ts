import { expect, test, type Page } from "./test";

/**
 * The reviewer demo: fictional board in localStorage. Covers the PRD's demo
 * acceptance check: add a place, compare, set a next step, reload and it
 * persists, reset, at desktop and iPhone sizes.
 */

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

async function openDemo(page: Page) {
  // Stub the address lookup so tests never depend on the Census or OSM services.
  await page.route("**/api/geocode?**", (route) =>
    route.fulfill({ json: { lat: 34.411, lng: -119.8575 }, headers: { "Cache-Control": "no-store" } })
  );
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Our place by the bluffs" }).first()).toBeVisible();
}

async function addPlace(page: Page, name: string) {
  await page.getByRole("button", { name: "Add a place" }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a place" });
  await dialog.getByRole("button", { name: /Fill it in by hand/ }).click();
  await dialog.getByLabel("Listing link").fill("https://example.com/listings/e2e");
  await dialog.getByLabel(/^Name/).fill(name);
  await dialog.getByLabel("Address").fill("6700 Trigo Rd, Isla Vista");
  await dialog.getByLabel("Rent for the whole place").fill("4,800");
  await dialog.getByRole("button", { name: "Into the corral" }).click();
  // A moment in the corral, then back to the board.
  await expect(dialog.getByText(/is in the corral$/)).toBeVisible();
  await dialog.getByRole("button", { name: "See it on the board" }).click();
  await expect(dialog).toBeHidden();
}

test("demo opens on the fictional board, signed out", async ({ page }) => {
  await openDemo(page);
  await expect(page.getByText("Fictional demo")).toBeVisible();
  await expect(page.getByText("Still in the running · 5")).toBeVisible();
  // The fence footer on phones, the fine print under the list on desktop: one of them shows.
  await expect(page.getByText("Demo data is fictional.").filter({ visible: true })).toHaveCount(1);
});

test("add a place, reload, and it's still there; reset restores the demo", async ({ page }) => {
  await openDemo(page);
  await addPlace(page, "E2E test house");
  const row = page.locator("article", { hasText: "Trigo Rd, 6700" });
  await expect(row).toBeVisible();
  await expect(row.getByText("$4,800")).toBeVisible();

  await page.reload();
  await expect(page.locator("article", { hasText: "Trigo Rd, 6700" })).toBeVisible();
  await expect(page.getByText("Still in the running · 6")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator("article", { hasText: "Trigo Rd, 6700" })).toHaveCount(0);
  await expect(page.getByText("Still in the running · 5")).toBeVisible();
});

test("unknown rent never shows as within budget in the comparison", async ({ page }) => {
  await openDemo(page);
  if (isPhone(page)) {
    for (const name of ["Sabado Tarde, 6512", "Trigo Rd, 6545"]) {
      await page.getByRole("button", { name, exact: true }).click();
      const sheet = page.getByRole("dialog");
      await sheet.getByRole("button", { name: "Add to compare" }).click();
      await sheet.getByRole("button", { name: "Back to the list" }).click();
      await expect(sheet).toBeHidden();
    }
  } else {
    await page.getByRole("checkbox", { name: "Compare Sabado Tarde, 6512" }).click();
    await expect(page.getByText("1 picked · pick one more").filter({ visible: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "Compare Trigo Rd, 6545" }).click();
  }
  await page.getByRole("button", { name: "Compare", exact: true }).filter({ visible: true }).click();

  await expect(page.getByRole("heading", { name: /Comparing 2/ })).toBeVisible();
  const budget = isPhone(page) ? ["Within", "Unknown"] : ["Within budget", "Rent unknown"];
  for (const text of budget) await expect(page.getByText(text, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Within budget", { exact: true }).filter({ visible: true })).toHaveCount(isPhone(page) ? 0 : 1);
});

test("set a status and a next step, and they persist", async ({ page }) => {
  await openDemo(page);
  let scope = page.locator("body");
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Trigo Rd, 6545", exact: true }).click();
    scope = page.getByRole("dialog");
  } else {
    await page.getByRole("button", { name: "Trigo Rd, 6545", exact: true }).click();
    scope = page.getByRole("region", { name: "Selected place: Trigo Rd, 6545" });
  }
  await scope.getByLabel("Status for Trigo Rd, 6545").selectOption("contacted");
  await scope.getByRole("button", { name: /Add a next step/ }).click();
  await scope.getByLabel("Next step").fill("Call about the price");
  await scope.getByRole("radiogroup", { name: "Who" }).getByText("Priya", { exact: true }).click();
  await expect(scope.getByRole("radio", { name: "Priya" })).toBeChecked();
  await scope.getByRole("button", { name: "Save next step" }).click();
  await expect(scope.getByText("Call about the price")).toBeVisible();

  await page.reload();
  const row = page.locator("article", { hasText: "Trigo Rd, 6545" });
  await expect(row.getByText("Contacted")).toBeVisible();
  if (!isPhone(page)) await expect(row.getByText(/Priya/)).toBeVisible();
});

test("two browsers have separate demo boards", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  await openDemo(pageA);
  await addPlace(pageA, "Only in browser A");
  await expect(pageA.locator("article", { hasText: "Trigo Rd, 6700" })).toBeVisible();

  await openDemo(pageB);
  await expect(pageB.getByText("Still in the running · 5")).toBeVisible();
  await expect(pageB.locator("article", { hasText: "Trigo Rd, 6700" })).toHaveCount(0);
  await a.close();
  await b.close();
});

test("a change in one demo tab shows up live in another", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await openDemo(a);
  await openDemo(b);
  await addPlace(a, "Live in both tabs");
  await expect(b.locator("article", { hasText: "Trigo Rd, 6700" })).toBeVisible();
  await expect(b.getByText("Still in the running · 6")).toBeVisible();
});

test("a place can be saved without a listing link", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Add a place" }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a place" });
  await dialog.getByRole("button", { name: /Start from an address/ }).click();
  await expect(dialog.getByLabel("Address")).toBeFocused();
  await dialog.getByLabel("Address").fill("6700 Trigo Rd, Isla Vista");
  await dialog.getByLabel(/^Name/).fill("Friend's place");
  await dialog.getByRole("button", { name: "Into the corral" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Trigo Rd, 6700", exact: true }).click();
  const place = isPhone(page) ? page.getByRole("dialog") : page.getByRole("region", { name: "Selected place: Trigo Rd, 6700" });
  await expect(place.getByRole("heading", { name: "Trigo Rd, 6700" })).toBeVisible();
  await expect(place.getByRole("link", { name: /Open listing/ })).toHaveCount(0);
});

test("adding a place with an address puts its pin on the map automatically", async ({ page }) => {
  await openDemo(page);
  await addPlace(page, "Auto pin");
  await expect(page.getByText(/drop its pin/)).toHaveCount(0);
});

test("after adding, the place drops into the corral, and you can round up another", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Add a place" }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add a place" });
  await dialog.getByRole("button", { name: /Fill it in by hand/ }).click();
  await dialog.getByLabel(/^Name/).fill("Corner unit");
  await dialog.getByLabel("Address").fill("6700 Trigo Rd, Isla Vista");
  await dialog.getByRole("button", { name: "Into the corral" }).click();
  await expect(dialog.getByText("Trigo Rd, 6700 is in the corral")).toBeVisible();
  await dialog.getByRole("button", { name: "Round up another" }).click();
  await expect(dialog.getByRole("heading", { name: "Round it up" })).toBeVisible();
  await expect(dialog.getByLabel("Paste a link or the listing's text")).toHaveValue("");
});
