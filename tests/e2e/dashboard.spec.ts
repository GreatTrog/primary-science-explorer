import { expect, test } from "@playwright/test";

test("dashboard loads pilot investigations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Primary Science Explorer")).toBeVisible();
  await expect(page.getByRole("link", { name: "Launch investigation" }).first()).toBeVisible();
});
