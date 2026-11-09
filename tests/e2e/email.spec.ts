import { expect, test } from "@playwright/test";
import { Client } from "pg";

const dbUrl = process.env.TEST_DATABASE_URL ?? "postgres://triff:triff@localhost:5432/triff_test";
const email = `correo-${Date.now()}@example.com`;
const password = "contraseña-segura-123";
const newPassword = "nueva-contraseña-segura-456";

async function lastLink(kind: string) {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();
  for (let i = 0; i < 40; i++) {
    const { rows } = await c.query("select body from email_log where \"to\" = $1 and kind = $2 order by created_at desc limit 1", [email, kind]);
    if (rows[0]?.body) {
      await c.end();
      return rows[0].body.match(/https?:\/\/\S+/)![0] as string;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  await c.end();
  throw new Error(`no ${kind} email`);
}

test.describe.serial("email flows", () => {
  test("verify email from the link in the welcome email", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Noa");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL("**/dashboard");
    const banner = page.getByRole("region", { name: "Confirma tu correo" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Reenviar el enlace" }).click();
    await expect(banner.getByText("Te lo hemos enviado")).toBeVisible();

    await page.goto(await lastLink("verify_email"));
    await expect(page.getByText("¡Correo confirmado! Gracias.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Confirma tu correo" })).toHaveCount(0);
  });

  test("forgot password → email link → new password → sign in", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "¿Has olvidado tu contraseña?" }).click();
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByText(/Si existe una cuenta con ese correo/)).toBeVisible();

    await page.goto(await lastLink("reset_password"));
    await expect(page).toHaveURL(/\/reset-password\?token=/);
    await page.getByLabel("Contraseña nueva").fill(newPassword);
    await page.getByLabel("Repite la contraseña").fill("otra-distinta-000");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
    await page.getByLabel("Repite la contraseña").fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    await page.waitForURL(/\/login\?reset=1/);
    await expect(page.getByText("Contraseña cambiada. Ya puedes entrar con la nueva.")).toBeVisible();
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(newPassword);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/dashboard");
  });

  test("a used or forged link shows a clear message", async ({ page }) => {
    await page.goto("/reset-password?token=token-falso-12345");
    await page.getByLabel("Contraseña nueva").fill(newPassword);
    await page.getByLabel("Repite la contraseña").fill(newPassword);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByText(/ha caducado o ya se ha usado/)).toBeVisible();
    await page.goto("/reset-password?error=INVALID_TOKEN");
    await expect(page.getByRole("heading", { name: "Enlace no válido" })).toBeVisible();
  });
});
