import { expect, test, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const dbUrl = process.env.TEST_DATABASE_URL ?? "postgres://triff:triff@localhost:5432/triff_test";
const stamp = Date.now();
const adminEmail = `admin-${stamp}@example.com`;
const studentEmail = `alumna-${stamp}@example.com`;
const supportEmail = `soporte-${stamp}@example.com`;
const password = "contraseña-segura-123";

function grant(email: string, role: string) {
  execFileSync("pnpm", ["exec", "tsx", "scripts/admin-role.mts", email, role], { env: { ...process.env, DATABASE_URL: dbUrl }, stdio: "pipe" });
}

async function register(browser: Browser, name: string, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/register");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("**/dashboard");
  return page;
}

test.describe.serial("admin panel", () => {
  let admin: Page;
  let student: Page;

  test("is invisible to students and enabled from the command line", async ({ browser }) => {
    student = await register(browser, "Alumna", studentEmail);
    const res = await student.goto("/admin");
    expect(res?.status()).toBe(404);
    await expect(student.getByRole("link", { name: "Panel de administración" })).toHaveCount(0);

    admin = await register(browser, "Directora", adminEmail);
    grant(adminEmail, "admin");
    await admin.goto("/dashboard");
    await admin.getByRole("link", { name: "Panel de administración" }).click();
    await expect(admin.getByRole("heading", { name: "Resumen" })).toBeVisible();
    await expect(admin.getByText("Operaciones IA (30 días)")).toBeVisible();
    await expect(admin.getByText(/el contenido de los apuntes de los estudiantes no se muestra/)).toBeVisible();
  });

  test("manages users: plan change and suspension that ends live sessions", async () => {
    await admin.goto(`/admin/users?q=${encodeURIComponent(studentEmail)}`);
    const row = admin.getByRole("row").filter({ hasText: studentEmail });
    await expect(row).toBeVisible();
    await row.getByLabel(`Plan de ${studentEmail}`).selectOption("premium");
    await expect(row.getByRole("cell").nth(1)).toContainText("Premium");

    admin.once("dialog", (d) => d.accept("Uso indebido"));
    await row.getByRole("button", { name: "Suspender" }).click();
    await expect(row.getByText("Suspendido")).toBeVisible();

    // The student's open session stops working immediately.
    await student.goto("/dashboard");
    await expect(student).toHaveURL(/\/login/);
    await student.getByLabel("Correo electrónico").fill(studentEmail);
    await student.getByLabel("Contraseña").fill(password);
    await student.getByRole("button", { name: "Entrar" }).click();
    await expect(student.getByText(/Si tu cuenta está suspendida/)).toBeVisible();
    await expect(student).toHaveURL(/\/login/);

    await row.getByRole("button", { name: "Reactivar" }).click();
    await expect(row.getByText("Suspendido")).toHaveCount(0);
  });

  test("cannot demote itself", async () => {
    await admin.goto(`/admin/users?q=${encodeURIComponent(adminEmail)}`);
    const row = admin.getByRole("row").filter({ hasText: adminEmail });
    await expect(row.getByLabel(`Rol de ${adminEmail}`)).toBeDisabled();
    await expect(row.getByRole("button", { name: "Suspender" })).toHaveCount(0);
  });

  test("edits settings and everything lands in the audit log", async () => {
    await admin.goto("/admin/settings");
    await expect(admin.getByText(/anthropic: (sin clave|clave configurada)/)).toBeVisible();
    await admin.getByLabel("Plan gratuito").fill("25");
    await admin.getByRole("button", { name: "Añadir modelo" }).click();
    await admin.getByLabel("Modelo 4").fill("modelo-propio");
    await admin.getByLabel("Precio de entrada 4").fill("1.5");
    await admin.getByLabel("Precio de salida 4").fill("3");
    await admin.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(admin.getByText("Configuración guardada y auditada.")).toBeVisible();
    await admin.reload();
    await expect(admin.getByLabel("Plan gratuito")).toHaveValue("25");
    await expect(admin.getByLabel("Modelo 4")).toHaveValue("modelo-propio");

    await admin.goto("/admin/errors");
    for (const a of ["Cambio de rol", "Cambio de plan", "Cuenta suspendida", "Cuenta reactivada", "Configuración actualizada"]) {
      await expect(admin.getByRole("cell", { name: a }).first()).toBeVisible();
    }
    await expect(admin.getByText("Motivo: Uso indebido").first()).toBeVisible();
    await expect(admin.getByText("línea de comandos").first()).toBeVisible();
  });

  test("support staff can read but not change anything", async ({ browser }) => {
    const sup = await register(browser, "Soporte", supportEmail);
    grant(supportEmail, "support");
    await sup.goto("/admin/users");
    await expect(sup.getByText("Solo lectura").first()).toBeVisible();
    await sup.goto("/admin/settings");
    await expect(sup.getByText(/solo permite consultar la configuración/)).toBeVisible();
    await expect(sup.getByLabel("Plan gratuito")).toBeDisabled();
    await expect(sup.getByRole("button", { name: "Guardar configuración" })).toHaveCount(0);
  });

  test.afterAll(async () => {
    // Keep the shared test DB tidy for other suites: restore default settings.
    const { Client } = await import("pg");
    const c = new Client({ connectionString: dbUrl });
    await c.connect();
    await c.query("delete from app_settings where key = 'config'");
    await c.end();
  });
});
