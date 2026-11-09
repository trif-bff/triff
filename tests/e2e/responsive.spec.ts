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

test("app navigation fits on a phone (bottom tab bar) without horizontal scroll", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout only");
  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Móvil");
  await page.getByLabel("Correo electrónico").fill(`movil-${Date.now()}@example.com`);
  await page.getByLabel("Contraseña").fill("contraseña-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/dashboard");
  for (const url of ["/dashboard", "/logros", "/tutor", "/subjects"]) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
    const nav = page.getByRole("navigation", { name: "Principal" });
    for (const name of ["Hoy", "Asignaturas", "Tutora", "Repaso", "Logros"]) {
      const box = await nav.getByRole("link", { name }).boundingBox();
      expect(box, `${url} ${name}`).not.toBeNull();
      expect(box!.x + box!.width, `${url} ${name}`).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    // The tab bar sits at the bottom of the screen…
    const navBox = (await nav.boundingBox())!;
    expect(navBox.y + navBox.height, `${url} nav at bottom`).toBeGreaterThan(page.viewportSize()!.height - 2);
    // …and does not cover the top bar actions.
    const signOut = page.getByRole("button", { name: "Cerrar sesión" });
    const so = (await signOut.boundingBox())!;
    expect(so.x + so.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const topmost = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label"), [so.x + so.width / 2, so.y + so.height / 2]);
    expect(topmost, `${url} sign-out not covered`).toBe("Cerrar sesión");
  }
});
