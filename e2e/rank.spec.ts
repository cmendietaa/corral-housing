import { expect, test, type Page } from "@playwright/test";

/**
 * The Rank tab on the demo board: requirements hold places back with a reason,
 * priorities change the order, they're saved on this device, and the top
 * places hand off to Compare. Desktop and iPhone.
 */

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

async function openRank(page: Page) {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Our place by the bluffs" }).first()).toBeVisible();
  await page.getByRole("group", { name: "View" }).filter({ visible: true }).getByRole("button", { name: "Rank" }).click();
  await expect(page.getByText(/Best fit for you · \d/)).toBeVisible();
}

/** The priorities: the side panel on desktop, a sheet on phones. */
async function priorities(page: Page) {
  if (isPhone(page)) {
    await page.getByRole("button", { name: /Edit$/ }).click();
    return page.getByRole("dialog", { name: "Your priorities" });
  }
  return page.getByRole("complementary", { name: "Your priorities" });
}

async function done(page: Page) {
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Show ranking" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
}

const cards = (page: Page) => page.getByRole("article").filter({ hasText: "/10" });

test("ranks the places that meet the requirements and says why the others don't", async ({ page }) => {
  await openRank(page);
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).first()).toContainText("/10");

  // Rent unknown: held back as missing info, with a way to fill it in.
  const missing = page.getByText(/Might fit, but missing info · 1/).locator("..");
  await expect(missing).toContainText("Trigo Rd");
  await expect(missing).toContainText("Rent unknown");
  await expect(missing.getByRole("button", { name: "Fill in Trigo Rd, 6545" })).toBeVisible();

  // Over the max: collapsed, with the reason in numbers.
  await page.getByText(/Doesn't meet your requirements · 1/).click();
  await expect(page.getByText("$1,800/person is over your $1,400 max")).toBeVisible();

  // Why? opens the breakdown.
  await cards(page).nth(1).getByRole("button", { name: "Why?" }).click();
  await expect(cards(page).nth(1)).toContainText(/Ranks below/);
});

test("changing priorities re-ranks, and they're saved on this device", async ({ page }) => {
  await openRank(page);
  await expect(cards(page).first()).toContainText("Sabado Tarde");

  let panel = await priorities(page);
  // Raise the max: Del Playa moves from "doesn't meet" into the ranking.
  await panel.getByLabel("Max rent per person").fill("1800");
  // Only parking & laundry matters: the garage + in-unit laundry place wins.
  for (const f of ["Price per person", "Bike time to campus", "Bedrooms per person", "Bathrooms per person"]) {
    await panel.getByRole("radiogroup", { name: f }).getByRole("radio", { name: "Don't care" }).click();
  }
  await panel.getByRole("radiogroup", { name: "Parking & laundry" }).getByRole("radio", { name: "Very" }).click();
  await done(page);

  await expect(cards(page)).toHaveCount(4);
  await expect(cards(page).first()).toContainText("Calle Real");

  await page.reload();
  await page.getByRole("group", { name: "View" }).filter({ visible: true }).getByRole("button", { name: "Rank" }).click();
  await expect(cards(page).first()).toContainText("Calle Real");

  panel = await priorities(page);
  await panel.getByRole("button", { name: "Reset" }).click();
  await done(page);
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).first()).toContainText("Sabado Tarde");
});

test("Compare top 3 opens Compare with the top places", async ({ page }) => {
  await openRank(page);
  await page.getByRole("button", { name: "Compare top 3" }).click();
  await expect(page.getByRole("heading", { name: /Comparing 3/ })).toBeVisible();
  for (const name of ["Sabado Tarde, 6512", "Pardall Rd, 6550", "Calle Real, 7150"]) {
    await expect(page.getByText(name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  }
});
