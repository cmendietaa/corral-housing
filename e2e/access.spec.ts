import { expect, test } from "@playwright/test";

/**
 * Signed-out access to private routes. Signed-in collaboration and outsider
 * denial at the database level are covered by supabase/tests/rls_check.sql.
 */

test("an invalid invite explains itself", async ({ page }) => {
  await page.goto("/invite/not-a-real-invite");
  await expect(page.getByRole("heading", { name: "This invite washed away" })).toBeVisible();
});

test("a private board asks a signed-out visitor to sign in, and reveals nothing", async ({ page }) => {
  await page.goto("/boards/11111111-1111-4111-8111-111111111111");
  await expect(page.getByRole("heading", { name: "Sign in to open this board" })).toBeVisible();
  await expect(page.getByText("Our place by the bluffs")).toHaveCount(0);
});

test("the boards page offers sign-in and the demo", async ({ page }) => {
  await page.goto("/boards");
  await expect(page.getByRole("heading", { name: "Sign in to see your boards" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try the demo board" })).toBeVisible();
});

test("the autofill API rejects bad input and fills a listing", async ({ request }) => {
  const short = await request.post("/api/parse-listing", { data: { text: "hi" } });
  expect(short.status()).toBe(400);
  const ok = await request.post("/api/parse-listing", {
    data: { text: "4BR/2BA duplex, $5,400/mo. Available Sept 1, 12-month lease." }
  });
  expect(ok.ok()).toBe(true);
  const body = await ok.json();
  expect(body.fields.rentCents).toBe(540000);
  expect(body.fields.beds).toBe(4);
});

test("the Street View proxy refuses places outside the service area", async ({ request }) => {
  const res = await request.get("/api/streetview?lat=40.7&lng=-74&s=card");
  expect(res.status()).toBe(404);
});
