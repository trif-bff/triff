"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/messages";

export function VerifyBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function resend() {
    setState("sending");
    const res = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard?verified=1" });
    if (res.error) {
      setState("error");
      setMsg(authErrorMessage(res.error));
    } else setState("sent");
  }
  return (
    <div role="region" aria-label="Confirma tu correo" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
      <MailCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1">
        Confirma tu correo (<strong>{email}</strong>) para poder recuperar tu cuenta si olvidas la contraseña.
      </p>
      {state === "sent" ? (
        <span role="status" className="font-medium text-ink-2">Te lo hemos enviado. Revisa tu bandeja.</span>
      ) : (
        <button onClick={resend} disabled={state === "sending"} className="font-medium text-primary hover:underline disabled:opacity-50">
          {state === "sending" ? "Enviando…" : "Reenviar el enlace"}
        </button>
      )}
      {state === "error" && <p role="alert" className="basis-full text-danger">{msg}</p>}
    </div>
  );
}
