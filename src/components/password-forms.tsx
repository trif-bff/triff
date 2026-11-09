"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";
import { Button, Card, Input, Label } from "@/components/ui";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email"));
    const res = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    // Same answer whether or not the account exists (no account enumeration).
    if (res.error && res.error.status === 429) return setError(authErrorMessage(res.error));
    setSent(true);
  }

  return (
    <Card className="p-6">
      <h1 className="font-display mb-1 text-2xl font-semibold">Recupera tu contraseña</h1>
      {sent ? (
        <div role="status" className="space-y-3 text-sm text-ink-2">
          <p>Si existe una cuenta con ese correo, te hemos enviado un enlace para crear una contraseña nueva. Caduca en 30 minutos.</p>
          <p className="text-ink-3">¿No llega? Revisa la carpeta de spam o vuelve a intentarlo en unos minutos.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <p className="text-sm text-ink-3">Escribe el correo de tu cuenta y te enviaremos un enlace.</p>
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-ink-3"><Link className="font-medium text-primary" href="/login">Volver a entrar</Link></p>
    </Card>
  );
}

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || invalid) {
    return (
      <Card className="p-6">
        <h1 className="font-display mb-2 text-2xl font-semibold">Enlace no válido</h1>
        <p className="text-sm text-ink-2">El enlace ha caducado o ya se ha usado. Pide uno nuevo.</p>
        <Link href="/forgot-password" className="mt-5 inline-block font-medium text-primary">Pedir un enlace nuevo</Link>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password !== String(f.get("confirm"))) return setError("Las contraseñas no coinciden.");
    setPending(true);
    setError(null);
    const res = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (res.error) {
      return setError(res.error.code === "INVALID_TOKEN" ? "El enlace ha caducado o ya se ha usado. Pide uno nuevo." : authErrorMessage(res.error));
    }
    router.push("/login?reset=1");
  }

  return (
    <Card className="p-6">
      <h1 className="font-display mb-1 text-2xl font-semibold">Crea una contraseña nueva</h1>
      <p className="mb-5 text-sm text-ink-3">Al guardarla se cerrarán tus sesiones abiertas en otros dispositivos.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">Contraseña nueva</Label>
          <Input id="password" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
          <p className="mt-1 text-xs text-ink-3">Mínimo 10 caracteres.</p>
        </div>
        <div>
          <Label htmlFor="confirm">Repite la contraseña</Label>
          <Input id="confirm" name="confirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</Button>
      </form>
    </Card>
  );
}
