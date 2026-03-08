import { expect, test } from "@playwright/test";

async function openSimulationStep(page: Parameters<typeof test>[0]["page"]) {
  const runButton = page.getByRole("button", { name: /run experiment|demo scene/i });

  for (let index = 0; index < 8; index += 1) {
    if (await runButton.isVisible()) {
      return;
    }

    const nextButton = page.getByRole("button", { name: /^next$/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();
  }

  await expect(runButton).toBeVisible();
}

test("teacher preview remains responsive after dropdown changes", async ({ page }) => {
  const teacherPreviewSlugs = [
    "/teacher/preview/dissolving-and-separating-mixtures",
    "/teacher/preview/parachute-drop-air-resistance",
    "/teacher/preview/voltage-brightness-resistance",
    "/teacher/preview/periscope-and-reflection",
  ];

  for (const slug of teacherPreviewSlugs) {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.removeAllListeners("pageerror");
    page.removeAllListeners("console");

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`${slug}: ${message.text()}`);
      }
    });

    await page.goto(slug);
    await openSimulationStep(page);

    const select = page.locator("select").first();
    await expect(select).toBeVisible();

    const options = await select.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLOptionElement).value),
    );
    const initialValue = await select.inputValue();
    const alternateValue = options.find((option) => option !== initialValue);

    if (alternateValue) {
      await select.selectOption(alternateValue);
      await page.waitForTimeout(300);
      await expect(page.getByRole("button", { name: /run experiment|demo scene/i })).toBeVisible();
      await expect(select).toHaveValue(alternateValue);

      await select.selectOption(initialValue);
      await page.waitForTimeout(300);
      await expect(select).toHaveValue(initialValue);
    }

    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
  }
});
