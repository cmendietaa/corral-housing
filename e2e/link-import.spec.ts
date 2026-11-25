import { expect, test, type Page } from "./test";

/**
 * Round it up from a link, in the add flow. The server route is stubbed here
 * (tests never fetch real sites); lib/link-import has unit tests for what it
 * reads and refuses.
 */

async function openAddForm(page: Page) {
  await page.route("**/api/geocode?**", (r) => r.fulfill({ json: { lat: 34.411, lng: -119.8575 } }));
  await page.goto("/demo");
  await page.getByRole("button", { name: "Add a place" }).filter({ visible: true }).first().click();
  return page.getByRole("dialog", { name: "Add a place" });
}

test("a listing link is rounded up into facts to check", async ({ page }) => {
  let sent: unknown = null;
  await page.route("**/api/import-link", async (r) => {
    sent = r.request().postDataJSON();
    // Slow enough to see the loading scene.
    await new Promise((done) => setTimeout(done, 2500));
    await r.fulfill({
      json: {
        fields: {
          title: "Upstairs 3BR on Pardall",
          address: "6550 Pardall Rd #2, Isla Vista",
          url: "https://ivrentals.example/listings/6550-pardall-2",
          rentCents: 480000,
          beds: 3,
          baths: 2,
          leaseStart: null,
          leaseEnd: null,
          parking: null,
          laundry: "on_site"
        },
        source: "parser",
        site: "ivrentals.example"
      }
    });
  });
  const form = await openAddForm(page);
  const roundUp = form.getByRole("button", { name: "Round it up", exact: true });
  await expect(roundUp).toBeDisabled();
  await form.getByLabel("Paste a link or the listing's text").fill("https://ivrentals.example/listings/6550-pardall-2");
  await expect(form.getByText("Link spotted.", { exact: false })).toBeVisible();
  await roundUp.click();

  // While it reads, the inputs give way to the loading scene.
  await expect(form.getByText("Rounding it up…")).toBeVisible();
  await expect(form.getByText("Reading ivrentals.example")).toBeVisible();
  await expect(form.getByLabel("Paste a link or the listing's text")).toHaveCount(0);

  await expect(form.getByRole("heading", { name: "Check what Corral found" })).toBeVisible();
  await expect(form.getByText(/Rounded up \d+ details from ivrentals\.example/)).toBeVisible();
  expect(sent).toEqual({ url: "https://ivrentals.example/listings/6550-pardall-2" });
  await expect(form.getByLabel(/^Name/)).toHaveValue("Upstairs 3BR on Pardall");
  await expect(form.getByLabel("Address")).toHaveValue("6550 Pardall Rd #2, Isla Vista");
  await expect(form.getByLabel("Rent for the whole place")).toHaveValue("4800");
  await expect(form.getByLabel("Listing link")).toHaveValue("https://ivrentals.example/listings/6550-pardall-2");
  // Parking wasn't in the listing: it's marked, and left as "Not sure".
  await expect(form.getByRole("radiogroup", { name: "Parking" }).getByRole("radio", { name: "Not sure" })).toBeChecked();
  await expect(form.getByText("Not in the listing").first()).toBeAttached();
});

test("a site that can't be read keeps the link and asks for text or a screenshot", async ({ page }) => {
  await page.route("**/api/import-link", (r) =>
    r.fulfill({
      json: {
        fallback: "skipped",
        message: "Zillow doesn't allow apps to read its listings. Paste the listing's text or add a screenshot instead."
      }
    })
  );
  const form = await openAddForm(page);
  await form.getByLabel("Paste a link or the listing's text").fill("https://www.zillow.com/homedetails/1_zpid/");
  await form.getByRole("button", { name: "Round it up", exact: true }).click();
  await expect(form.getByText("Zillow doesn't allow apps to read its listings.", { exact: false })).toBeVisible();
  await expect(form.getByText("The link is kept on the place.")).toBeVisible();
  // The box is cleared for the text or a screenshot.
  await expect(form.getByLabel("Paste a link or the listing's text")).toHaveValue("");

  await form.getByRole("button", { name: /Fill it in by hand/ }).click();
  await expect(form.getByLabel("Listing link")).toHaveValue("https://www.zillow.com/homedetails/1_zpid/");
});

test("a studio reads as Studio, and going back to read again replaces what Corral filled", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/import-link", (r) => {
    calls += 1;
    const base = { address: "6531 Del Playa Dr #06, Isla Vista", url: null, rentCents: null, baths: 1, leaseStart: null, leaseEnd: null, parking: null, laundry: null };
    return r.fulfill({
      json: { fields: { ...base, title: calls === 1 ? "First read" : "Second read", beds: 0 }, source: "parser", site: "rlwa.example" }
    });
  });
  const form = await openAddForm(page);
  await form.getByLabel("Paste a link or the listing's text").fill("https://rlwa.example/listings/1");
  await form.getByRole("button", { name: "Round it up", exact: true }).click();
  await expect(form.getByLabel(/^Name/)).toHaveValue("First read");
  await expect(form.getByLabel("Bedrooms")).toHaveValue("Studio");
  // One more bedroom: a 1-bed. One fewer from there: a studio again.
  await form.getByRole("button", { name: "One more bedroom" }).click();
  await expect(form.getByLabel("Bedrooms")).toHaveValue("1");
  await form.getByRole("button", { name: "One fewer bedroom" }).click();
  await expect(form.getByLabel("Bedrooms")).toHaveValue("Studio");

  await form.getByRole("button", { name: "Back to round it up" }).click();
  await form.getByLabel("Paste a link or the listing's text").fill("https://rlwa.example/listings/1");
  await form.getByRole("button", { name: "Round it up", exact: true }).click();
  await expect(form.getByLabel(/^Name/)).toHaveValue("Second read");
  await expect(form.getByText(/Rounded up \d+ details from rlwa\.example/)).toBeVisible();
});

test("photos from the listing are offered, and only the picked ones are kept", async ({ page }) => {
  const IMAGE = "docs/screenshots/board.png";
  await page.route("https://photos.ivrentals.example/**", (r) => r.fulfill({ path: IMAGE, contentType: "image/png" }));
  let fetched: string[] = [];
  await page.route("**/api/listing-photo?**", (r) => {
    fetched.push(new URL(r.request().url()).searchParams.get("url")!);
    return r.fulfill({ path: IMAGE, contentType: "image/png" });
  });
  await page.route("**/api/import-link", (r) =>
    r.fulfill({
      json: {
        fields: { title: "Garden cottage", address: "6600 Picasso Rd, Isla Vista", url: null, rentCents: 320000, beds: 2, baths: 1, leaseStart: null, leaseEnd: null, parking: null, laundry: null },
        source: "parser",
        site: "ivrentals.example",
        photos: ["https://photos.ivrentals.example/front.jpg", "https://photos.ivrentals.example/kitchen.jpg"]
      }
    })
  );
  const form = await openAddForm(page);
  await form.getByLabel("Paste a link or the listing's text").fill("https://ivrentals.example/listings/garden-cottage");
  await form.getByRole("button", { name: "Round it up", exact: true }).click();

  const photos = form.getByRole("region", { name: "Photos from the listing" });
  await expect(photos.getByRole("button", { name: /^Keep photo \d from the listing$/ })).toHaveCount(2);
  await photos.getByRole("button", { name: "Keep photo 2 from the listing" }).click();
  await expect(photos.getByRole("button", { name: "Photo 2 from the listing, kept as the cover" })).toHaveAttribute("aria-pressed", "true");

  fetched = [];
  await form.getByRole("button", { name: "Into the corral" }).click();
  await expect(form.getByText("Picasso Rd, 6600 is in the corral")).toBeVisible();
  expect(fetched).toEqual(["https://photos.ivrentals.example/kitchen.jpg"]);
  await form.getByRole("button", { name: "See it on the board" }).click();
  await expect(form).toBeHidden();
});
