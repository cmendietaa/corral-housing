import { expect, test } from "./test";

/**
 * Board settings on the demo: the board's details can be changed and stay
 * after a reload; the fictional roommates are listed but can't be removed.
 * (Private-board rules, like who can remove whom, are enforced in Postgres
 * and covered by supabase/tests/rls_check.sql.)
 */

test("rename the demo board and change its budget; it stays after a reload", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Our place by the bluffs" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Board settings" }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Board settings" });
  await expect(dialog).toBeVisible();

  // Roommates are shown, without remove buttons on the demo.
  await expect(dialog.getByRole("heading", { name: /The crew · 4/ })).toBeVisible();
  await expect(dialog.getByText("Jordan")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Remove/ })).toHaveCount(0);

  const save = dialog.getByRole("button", { name: "Save changes" });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Board name").fill("");
  await save.click();
  await expect(dialog.getByRole("alert")).toHaveText("Give the board a name");

  await dialog.getByLabel("Board name").fill("Bluffs or bust");
  await dialog.getByLabel("Budget per person").fill("1,500");
  await save.click();
  await expect(dialog.getByRole("status")).toHaveText("Saved");

  await dialog.getByRole("button", { name: "Close settings" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Bluffs or bust" }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Bluffs or bust" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Board settings" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Board settings" }).getByLabel("Budget per person")).toHaveValue("1500");
});

test("a bigger group splits the rent more ways", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText("$1,350 / person").first()).toBeVisible();
  await page.getByRole("button", { name: "Board settings" }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Board settings" });
  await expect(dialog.getByRole("group", { name: "People in your group" })).toContainText("4");
  await dialog.getByRole("button", { name: "One more person" }).click();
  await expect(dialog.getByText("1 not on the board yet")).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Saved");
  await dialog.getByRole("button", { name: "Close settings" }).click();
  // Sabado Tarde: $5,400 for 5 people in 4 bedrooms, one double: a range until the group decides.
  await expect(page.getByText("$900–$1,200 / person").first()).toBeVisible();
});
