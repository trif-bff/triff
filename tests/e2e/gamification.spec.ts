import { expect, test } from "@playwright/test";
import path from "node:path";

test("gamification rewards real activity and can be hidden", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Pau");
  await page.getByLabel("Correo electrónico").fill(`game-${Date.now()}@example.com`);
  await page.getByLabel("Contraseña").fill("contraseña-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/dashboard");

  // Before having notes, today's challenge is to upload them.
  await expect(page.getByRole("heading", { name: "Retos de hoy" })).toBeVisible();
  await expect(page.getByText("Sube los apuntes de una asignatura")).toBeVisible();
  await expect(page.getByRole("link", { name: /Nivel 1/ })).toBeVisible();

  await page.goto("/subjects?new=1");
  await page.getByLabel("Asignatura").fill("Contabilidad");
  await page.getByRole("button", { name: "Crear asignatura" }).click();
  await page.waitForURL(/\/subjects\/[0-9a-f-]{36}$/);
  await page.getByTestId("file-input").setInputFiles(path.join(__dirname, "../fixtures/contabilidad.md"));
  await expect(page.getByRole("status")).toContainText("fragmentos indexados", { timeout: 20_000 });
  await page.getByRole("button", { name: "Generar flashcards" }).click();
  await expect(page.getByText(/tarjetas nuevas/)).toBeVisible({ timeout: 20_000 });

  // Reviewing due cards earns XP.
  await page.goto("/review");
  await page.getByRole("button", { name: /Mostrar respuesta/ }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByText(/\+\d+ XP/).first()).toBeVisible();

  // Achievements page: badge earned, rules explained.
  await page.goto("/logros");
  await expect(page.getByText(/Nivel \d+ · /)).toBeVisible();
  const badge = page.getByRole("listitem").filter({ hasText: "Primeros apuntes" });
  await expect(badge.getByText("Conseguida")).toBeVisible();
  await expect(page.getByText("Cómo se ganan los puntos")).toBeVisible();
  await expect(page.getByText(/con estudio en las últimas 12 semanas/)).toBeVisible();

  // Students can hide it; real progress stays.
  await page.getByRole("button", { name: "Ocultar puntos y retos" }).click();
  await expect(page.getByText("Has ocultado los puntos, niveles y retos.")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Retos de hoy" })).toHaveCount(0);
  await expect(page.getByText("Dominio global")).toBeVisible();
  await page.goto("/logros");
  await page.getByRole("button", { name: "Volver a mostrarlos" }).click();
  await expect(page.getByText("Insignias")).toBeVisible();
});
