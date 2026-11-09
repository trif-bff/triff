"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";
import { Button, Card, Input, Label } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    const res =
      mode === "register"
        ? await authClient.signUp.email({ email, password, name: String(f.get("name")), callbackURL: "/dashboard?verified=1" })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      setError(authErrorMessage(res.error));
      return;
    }
    const next = params.get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <Card className="p-6">
      <h1 className="font-display mb-1 text-2xl font-semibold">{mode === "login" ? "Hola de nuevo" : "Crea tu cuenta"}</h1>
      <p className="mb-6 text-sm text-ink-3">{mode === "login" ? "Continúa donde lo dejaste." : "Tu plan de estudio empieza aquí."}</p>
      {mode === "login" && params.get("reset") === "1" && (
        <p role="status" className="mb-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Contraseña cambiada. Ya puedes entrar con la nueva.</p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        {mode === "register" && (
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required autoComplete="given-name" maxLength={80} />
          </div>
        )}
        <div>
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" required minLength={10} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && <p className="mt-1 text-xs text-ink-3">Mínimo 10 caracteres.</p>}
          {mode === "login" && (
            <p className="mt-1.5 text-right text-xs"><Link className="text-primary hover:underline" href="/forgot-password">¿Has olvidado tu contraseña?</Link></p>
          )}
        </div>
        {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-3">
        {mode === "login" ? (
          <>¿No tienes cuenta? <Link className="font-medium text-primary" href="/register">Regístrate</Link></>
        ) : (
          <>¿Ya tienes cuenta? <Link className="font-medium text-primary" href="/login">Entra</Link></>
        )}
      </p>
    </Card>
  );
}
