import { expect, test, type Page } from "@playwright/test";

/**
 * Screenshot autofill on the demo. The API route is stubbed, so these tests
 * check the browser side: picking, shrinking, sending, filling and reviewing.
 * What the model reads is measured by the extraction benchmark instead.
 */

const FIELDS = {
  title: "3BD / 2BA house on Sueno",
  address: "6741 Sueno Rd, Isla Vista",
  url: null,
  rentCents: 510000,
  beds: 3,
  baths: 2,
  leaseStart: "2027-09-01",
  leaseEnd: "2028-08-31",
  parking: "driveway",
  laundry: "in_unit"
};

async function openAddForm(page: Page) {
  await page.route("**/api/geocode?**", (route) =>
    route.fulfill({ json: { lat: 34.4125, lng: -119.861 }, headers: { "Cache-Control": "no-store" } })
  );
  await page.goto("/demo");
  await page.getByRole("button", { name: "Add a place" }).filter({ visible: true }).first().click();
  return page.getByRole("dialog");
}

test("the sample screenshot fills the form, and the place saves without a link", async ({ page }) => {
  const requests: { contentType: string; size: number }[] = [];
  await page.route("**/api/parse-listing", async (route) => {
    const req = route.request();
    requests.push({ contentType: req.headers()["content-type"] ?? "", size: req.postDataBuffer()?.length ?? 0 });
    await route.fulfill({ json: { fields: FIELDS, source: "ai" } });
  });
  const dialog = await openAddForm(page);

  await dialog.getByRole("button", { name: "Try a sample screenshot" }).click();
  await expect(dialog.getByRole("button", { name: "View screenshot 1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Autofill", exact: true }).click();

  await expect(dialog.getByText("Filled 9 fields from your screenshot. Check them against it before saving.")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]!.contentType).toMatch(/^multipart\/form-data/);
  expect(requests[0]!.size).toBeLessThan(1.5 * 1024 * 1024);
  await expect(dialog.getByLabel("Address")).toHaveValue("6741 Sueno Rd, Isla Vista");
  await expect(dialog.getByLabel("Rent for the whole place")).toHaveValue("5100");

  // Check the fields against the screenshot at full size, then close it.
  await dialog.getByRole("button", { name: "View screenshot 1" }).click();
  const viewer = page.getByRole("dialog", { name: "Screenshot 1 of 1" });
  await expect(viewer.getByRole("img", { name: "Screenshot 1 of the listing" })).toBeVisible();
  await viewer.getByRole("button", { name: "Close screenshot" }).click();
  await expect(viewer).toBeHidden();

  await dialog.getByRole("button", { name: "Add place" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Sueno Rd, 6741", exact: true })).toBeVisible();
});

test("an uploaded screenshot can be removed, and an unreadable one says to paste the text", async ({ page }) => {
  await page.route("**/api/parse-listing", (route) =>
    route.fulfill({ status: 503, json: { error: "Screenshot reading isn't available right now. Paste the listing's text instead." } })
  );
  const dialog = await openAddForm(page);
  const autofill = dialog.getByRole("button", { name: "Autofill", exact: true });
  await expect(autofill).toBeDisabled();

  await dialog.getByLabel("Add screenshots of the listing").setInputFiles("public/samples/listing-screenshot.jpg");
  await expect(dialog.getByRole("button", { name: "View screenshot 1" })).toBeVisible();
  await expect(autofill).toBeEnabled();
  await autofill.click();
  await expect(dialog.getByText("Paste the listing's text instead.", { exact: false })).toBeVisible();

  await dialog.getByRole("button", { name: "Remove screenshot 1" }).click();
  await expect(dialog.getByRole("button", { name: "View screenshot 1" })).toHaveCount(0);
  await expect(autofill).toBeDisabled();
});

test("a file that isn't an image is turned away in the browser", async ({ page }) => {
  let called = false;
  await page.route("**/api/parse-listing", (route) => {
    called = true;
    return route.fulfill({ json: { fields: FIELDS, source: "ai" } });
  });
  const dialog = await openAddForm(page);
  await dialog.getByLabel("Add screenshots of the listing").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image")
  });
  await expect(dialog.getByText("That isn't an image. Add a screenshot (PNG or JPEG).")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "View screenshot 1" })).toHaveCount(0);
  expect(called).toBe(false);
});
