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
  await expect(dialog.getByRole("heading", { name: "Roommates · 4" })).toBeVisible();
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
