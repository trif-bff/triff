import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { Client } from "pg";

const email = `mock-${Date.now()}@example.com`;
const password = "contraseña-segura-123";
const dbUrl = process.env.TEST_DATABASE_URL ?? "postgres://triff:triff@localhost:5432/triff_test";

async function setup(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Marta");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/subjects?new=1");
  await page.getByLabel("Asignatura").fill("Contabilidad");
  await page.getByLabel("Nota objetivo").fill("7");
  await page.getByRole("button", { name: "Crear asignatura" }).click();
  await page.waitForURL(/\/subjects\/[0-9a-f-]{36}$/);
  await page.getByTestId("file-input").setInputFiles(path.join(__dirname, "../fixtures/contabilidad.md"));
  await expect(page.getByRole("status")).toContainText("fragmentos indexados", { timeout: 20_000 });
}

test.describe.serial("mock written exam", () => {
  test("take a timed mock and get a report that survives reload", async ({ page }) => {
    await setup(page);
    await page.getByLabel("Número de preguntas").fill("8");
    await page.getByLabel("Duración (minutos)").fill("10");
    await page.getByRole("button", { name: "Empezar simulacro" }).click();
    await page.waitForURL(/\/quiz\//);
    await expect(page.getByRole("heading", { name: /Simulacro 1/ })).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
    // No answers or explanations before submitting.
    await expect(page.getByText(/Según tus apuntes/)).toHaveCount(0);

    const groups = page.locator("fieldset");
    expect(await groups.count()).toBe(8);
    for (let i = 0; i < 6; i++) await groups.nth(i).locator("label").first().click();
    await page.getByRole("button", { name: "Entregar" }).click();

    const report = page.getByRole("region", { name: "Informe del simulacro" });
    await expect(report.getByText("Nota orientativa")).toBeVisible();
    await expect(report.getByText("6/8 respondidas", { exact: false })).toBeVisible();
    await expect(report.getByText("Resultado por tema")).toBeVisible();
    await expect(page.getByText("Sin responder.").first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole("region", { name: "Informe del simulacro" })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(0);
  });

  test("auto-submits when time runs out and flags it as late", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/dashboard");
    await page.goto("/subjects");
    await page.getByRole("link", { name: /Contabilidad/ }).first().click();
    await page.getByLabel("Número de preguntas").fill("5");
    await page.getByLabel("Duración (minutos)").fill("5");
    await page.getByRole("button", { name: "Empezar simulacro" }).click();
    await page.waitForURL(/\/quiz\/([0-9a-f-]{36})/);
    const quizId = page.url().split("/quiz/")[1];

    // Simulate 6 minutes elapsing on the server clock.
    const c = new Client({ connectionString: dbUrl });
    await c.connect();
    await c.query("update quizzes set started_at = now() - interval '6 minutes' where id = $1", [quizId]);
    await c.end();

    await page.reload();
    const report = page.getByRole("region", { name: "Informe del simulacro" });
    await expect(report.getByText("Entregado fuera de tiempo.")).toBeVisible({ timeout: 10_000 });
    await expect(report.getByText(/simulacro anterior/)).toBeVisible();

    await page.getByRole("link", { name: "Ver mi plan" }).click();
    await expect(page.getByText(/Simulacro 2 · Contabilidad/)).toBeVisible();
    await expect(page.getByText(/fuera de tiempo/)).toBeVisible();
  });
});
