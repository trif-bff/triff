import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const email = `e2e-${Date.now()}@example.com`;
const password = "contraseña-segura-123";

async function register(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Nombre").fill("Lucía Pérez");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.serial("MVP acceptance flow", () => {
  test("redirects anonymous users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("full study loop", async ({ page }) => {
    // 1. Create an account
    await register(page);
    await expect(page.getByRole("heading", { name: /Lucía/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "¿Qué quieres aprender hoy?" })).toBeVisible();

    // 2. Create a subject (exam prep)
    await page.goto("/subjects?new=1");
    await page.getByLabel("Asignatura").fill("Contabilidad");
    await page.getByLabel("Nivel académico").fill("FP Grado Superior");
    const exam = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
    await page.getByLabel("Fecha del examen").fill(exam);
    await page.getByLabel("Nota objetivo").fill("8");
    await page.getByRole("button", { name: "Crear asignatura" }).click();
    await page.waitForURL(/\/subjects\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Contabilidad" })).toBeVisible();

    // 3-4. Upload and process notes
    await page.getByTestId("file-input").setInputFiles(path.join(__dirname, "../fixtures/contabilidad.md"));
    await expect(page.getByRole("status")).toContainText("fragmentos indexados", { timeout: 20_000 });
    await expect(page.getByText("Tema 2. Los asientos contables").first()).toBeVisible();

    // 5. Study plan is generated
    await expect(page.getByText(/Aprender · Tema/).first()).toBeVisible();

    // 6. Generate flashcards
    await page.getByRole("button", { name: "Generar flashcards" }).click();
    await expect(page.getByText(/tarjetas nuevas/)).toBeVisible({ timeout: 20_000 });

    // 7. Review flashcards (FSRS)
    await page.goto("/review");
    await page.getByRole("button", { name: /Mostrar respuesta/ }).click();
    await page.getByRole("button", { name: /^Bien/ }).click();
    await expect(page.getByText(/restantes/)).toBeVisible();

    // 8. Generate and take a quiz
    await page.goto("/subjects");
    await page.getByRole("link", { name: /Contabilidad/ }).first().click();
    await page.getByRole("button", { name: "Generar cuestionario" }).click();
    await page.waitForURL(/\/quiz\//, { timeout: 20_000 });
    const groups = page.locator("fieldset");
    const n = await groups.count();
    expect(n).toBeGreaterThan(2);
    for (let i = 0; i < n; i++) await groups.nth(i).locator("label").first().click();
    await page.getByRole("button", { name: "Entregar" }).click();

    // 9. Evaluated with explanations and saved
    await expect(page.getByText(new RegExp(`^\\d+/${n}$`))).toBeVisible();
    await expect(page.getByText(/Según tus apuntes/).first()).toBeVisible();

    // 10. Tutor (offline mode) answers from the notes with citations
    await page.goto("/tutor?mode=solver");
    await expect(page.getByRole("tab", { name: "Resolver paso a paso" })).toHaveAttribute("aria-selected", "true");
    await page.getByLabel("Mensaje para la tutora").fill("¿Qué es la partida doble?");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByText("Fuentes de tus apuntes")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/\[1\] contabilidad\.md/)).toBeVisible();

    // 11. Progress is visible on the dashboard
    await page.goto("/dashboard");
    await expect(page.getByText("Dominio global")).toBeVisible();
    await expect(page.getByText(/1 día/)).toBeVisible(); // streak from today's evidence
    await expect(page.getByRole("link", { name: /Contabilidad/ }).first()).toBeVisible();
  });

  test("PDF upload keeps page numbers", async ({ page, browser }) => {
    // Build a real 2-page PDF with Chromium.
    const pdfPage = await browser.newPage();
    await pdfPage.setContent(`<h1>Tema 1. Derivadas</h1><p>La derivada es el límite del cociente incremental cuando el incremento tiende a cero.</p><div style="page-break-after:always"></div><h1>Tema 2. Integrales</h1><p>La integral es la operación inversa de la derivada y permite calcular áreas bajo una curva.</p>`);
    const pdf = await pdfPage.pdf({ format: "A4" });
    await pdfPage.close();

    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/dashboard");
    await page.goto("/subjects?new=1");
    await page.getByLabel("Asignatura").fill("Matemáticas");
    await page.getByRole("button", { name: "Crear asignatura" }).click();
    await page.waitForURL(/\/subjects\/[0-9a-f-]{36}$/);
    await page.getByTestId("file-input").setInputFiles({ name: "calculo.pdf", mimeType: "application/pdf", buffer: pdf });
    await expect(page.getByRole("status")).toContainText("fragmentos indexados", { timeout: 20_000 });
    await expect(page.getByText("2 págs.")).toBeVisible();
    await expect(page.getByText(/OCR ·/)).toHaveCount(0); // text-layer PDF: no OCR needed

    // A photo of handwritten-style notes goes through OCR.
    await page.getByTestId("file-input").setInputFiles(path.join(__dirname, "../fixtures/apuntes-foto.jpg"));
    await expect(page.getByRole("status")).toContainText("texto reconocido en 1 página", { timeout: 60_000 });
    await expect(page.getByText(/OCR · \d+ %/)).toBeVisible();
    await expect(page.getByText("Tema 1. La célula").first()).toBeVisible();

    await page.goto("/tutor");
    await page.getByLabel("Asignatura").selectOption({ label: "Matemáticas" });
    await page.getByLabel("Mensaje para la tutora").fill("integral");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByText(/calculo\.pdf, p\. 2/)).toBeVisible({ timeout: 20_000 });
  });

  test("rejects cross-origin mutations (CSRF)", async ({ request }) => {
    const res = await request.post("/api/review", { headers: { Origin: "https://evil.example" }, data: {} });
    expect(res.status()).toBe(403);
  });
});
