import { expect, test } from "@playwright/test";

test("landing and login work on a phone without horizontal scroll", async ({ page }) => {
  for (const url of ["/", "/login", "/register"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Empezar gratis" })).toBeVisible();
});
