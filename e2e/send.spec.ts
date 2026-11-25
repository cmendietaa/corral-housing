import { expect, test } from "./test";
import { encodeFragment } from "../lib/send/payload";

/**
 * Send to Corral: a listing arrives from the person's own browser (desktop
 * bookmark or iPhone Shortcut), they pick a board, and it opens straight into
 * Round it up. The reading route is stubbed; what's checked is that the page's
 * rendered text, rent included, gets to it.
 */

const FIELDS = {
  title: "Studio on Del Playa",
  address: "6531 Del Playa Dr #06, Isla Vista",
  url: null,
  rentCents: 275000,
  beds: 0,
  baths: 1,
  leaseStart: null,
  leaseEnd: null,
  parking: null,
  laundry: null
};

test("the iPhone Shortcut's link opens the listing on the board you pick", async ({ page }) => {
  await page.route("**/api/geocode?**", (r) => r.fulfill({ json: { lat: 34.4096, lng: -119.8583 } }));
  await page.route("**/api/import-page", (r) => r.fulfill({ json: { fields: FIELDS, source: "parser", site: "rlwa.example" } }));
  const sent = { v: 1 as const, url: "https://www.rlwa.example/listings/1", title: "Studio on Del Playa", text: "$2,750 / MONTH\nStudio · 1 bath", ld: [], images: [] };
  await page.goto(`/send#${encodeFragment(sent)}`);

  await expect(page.getByRole("heading", { name: "Round it up from rlwa.example" })).toBeVisible();
  // The listing never stays in the address bar.
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("");

  await page.getByRole("button", { name: /The demo board/ }).click();
  const form = page.getByRole("dialog", { name: "Add a place" });
  await expect(form.getByRole("heading", { name: "Check what Corral found" })).toBeVisible();
  await expect(form.getByLabel("Rent for the whole place")).toHaveValue("2750");
  await expect(form.getByLabel("Bedrooms")).toHaveValue("Studio");
  await expect(form.getByLabel("Listing link")).toHaveValue("https://www.rlwa.example/listings/1");
});

test("the desktop bookmark sends a rent the site only shows after its scripts run", async ({ page, context }) => {
  test.skip((page.viewportSize()?.width ?? 1280) < 1024, "The bookmark is for computers; phones use the Shortcut.");
  let received = null as { text?: string; url?: string; images?: string[] } | null;
  await context.route("**/api/import-page", async (r) => {
    received = r.request().postDataJSON();
    await r.fulfill({ json: { fields: FIELDS, source: "parser", site: "listing.example" } });
  });
  await context.route("**/api/geocode?**", (r) => r.fulfill({ json: { lat: 34.4096, lng: -119.8583 } }));
  // A listing site like rlwa.com: the rent isn't in the HTML, a script fills it in after load.
  await context.route("https://listing.example/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      // Its gallery is background images, like many listing sites.
      body: `<!doctype html><title>Studio on Del Playa</title><h1>6531 Del Playa Drive</h1><p id="price">Loading…</p>
        <div style="width:480px;height:320px;background-image:url('https://listing.example/photos/front.jpg')"></div>
        <script>setTimeout(() => { document.getElementById("price").textContent = "$2,750 / MONTH"; }, 50)</script>`
    })
  );

  // Get the real bookmark from Board settings.
  await page.goto("/demo");
  await page.getByRole("button", { name: "Board settings" }).filter({ visible: true }).first().click();
  const settings = page.getByRole("dialog", { name: "Board settings" });
  await settings.getByRole("button", { name: "Set it up" }).click();
  const link = settings.getByRole("link", { name: "Send to Corral" });
  await expect(link).toHaveAttribute("href", /^javascript:/);
  const code = decodeURIComponent((await link.getAttribute("href"))!.slice("javascript:".length));

  // Click it on the listing.
  const listing = await context.newPage();
  await listing.goto("https://listing.example/1");
  await expect(listing.getByText("$2,750 / MONTH")).toBeVisible();
  const [send] = await Promise.all([context.waitForEvent("page"), listing.evaluate(code)]);

  await expect(send.getByRole("heading", { name: "Round it up from listing.example" })).toBeVisible();
  await send.getByRole("button", { name: /The demo board/ }).click();
  await expect(send.getByRole("dialog", { name: "Add a place" }).getByRole("heading", { name: "Check what Corral found" })).toBeVisible();
  expect(received).not.toBeNull();
  expect(received!.url).toBe("https://listing.example/1");
  expect(received!.text).toContain("$2,750 / MONTH");
  expect(received!.images).toContain("https://listing.example/photos/front.jpg");
});

test("opening Send to Corral with nothing sent explains where to set it up", async ({ page }) => {
  await page.goto("/send");
  await expect(page.getByRole("heading", { name: "Nothing was sent" })).toBeVisible();
});
