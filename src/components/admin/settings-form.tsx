"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updateSettings, type AdminResult } from "@/app/(admin)/admin/actions";
import { Button, Card, Input, Label } from "@/components/ui";
import type { Settings } from "@/lib/admin/settings-schema";

export function SettingsForm({ settings, readOnly, providers }: { settings: Settings; readOnly: boolean; providers: Record<string, boolean> }) {
  const [state, action, pending] = useActionState<AdminResult, FormData>(updateSettings, undefined);
  const [prices, setPrices] = useState(Object.entries(settings.prices).map(([model, p]) => ({ key: model, model, ...p })));
  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={readOnly || pending} className="space-y-6">
        <Card>
          <legend className="mb-1 font-semibold">Planes y límites</legend>
          <p className="mb-4 text-sm text-ink-3">Operaciones de IA por usuario y día. Los administradores no tienen límite. Las operaciones fallidas no cuentan.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="free_limit">Plan gratuito</Label>
              <Input id="free_limit" name="free_limit" type="number" min={0} max={100000} defaultValue={settings.plans.free.aiDailyLimit} />
            </div>
            <div>
              <Label htmlFor="premium_limit">Plan premium</Label>
              <Input id="premium_limit" name="premium_limit" type="number" min={0} max={100000} defaultValue={settings.plans.premium.aiDailyLimit} />
            </div>
          </div>
        </Card>

        <Card>
          <legend className="mb-1 font-semibold">Proveedor y modelos</legend>
          <p className="mb-4 text-sm text-ink-3">
            Las claves de API solo se configuran como variables de entorno del servidor y nunca se muestran aquí. Deja un campo vacío para usar el valor por defecto.
          </p>
          <ul className="mb-4 flex flex-wrap gap-2 text-xs">
            {Object.entries(providers).map(([p, ok]) => (
              <li key={p} className={ok ? "rounded-md bg-success/10 px-2 py-1 text-success" : "rounded-md bg-surface-2 px-2 py-1 text-ink-3"}>
                {p}: {ok ? "clave configurada" : "sin clave"}
              </li>
            ))}
          </ul>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="provider">Proveedor</Label>
              <select id="provider" name="provider" defaultValue={settings.ai.provider ?? ""} className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm">
                <option value="">Por defecto (variable AI_PROVIDER)</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div>
              <Label htmlFor="model_tutor">Modelo del tutor</Label>
              <Input id="model_tutor" name="model_tutor" defaultValue={settings.ai.models.tutor ?? ""} placeholder="claude-opus-5-5" />
            </div>
            <div>
              <Label htmlFor="model_generation">Modelo de generación</Label>
              <Input id="model_generation" name="model_generation" defaultValue={settings.ai.models.generation ?? ""} placeholder="claude-opus-5-5" />
            </div>
          </div>
        </Card>

        <Card>
          <legend className="mb-1 font-semibold">Precios para estimar costes</legend>
          <p className="mb-4 text-sm text-ink-3">USD por millón de tokens. Son precios de lista: verifícalos con el proveedor antes de tomar decisiones de facturación.</p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_7rem_7rem_2.5rem] gap-2 text-xs font-medium text-ink-3">
              <span>Modelo</span><span>Entrada</span><span>Salida</span><span />
            </div>
            {prices.map((p, i) => (
              <div key={p.key} className="grid grid-cols-[1fr_7rem_7rem_2.5rem] gap-2">
                <Input name="price_model" aria-label={`Modelo ${i + 1}`} defaultValue={p.model} required />
                <Input name="price_input" aria-label={`Precio de entrada ${i + 1}`} type="number" step="0.01" min={0} defaultValue={p.input} required />
                <Input name="price_output" aria-label={`Precio de salida ${i + 1}`} type="number" step="0.01" min={0} defaultValue={p.output} required />
                <button type="button" onClick={() => setPrices((ps) => ps.filter((x) => x.key !== p.key))} className="grid place-items-center rounded-xl text-ink-3 hover:bg-danger-soft hover:text-danger" aria-label={`Eliminar ${p.model}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setPrices((ps) => [...ps, { key: crypto.randomUUID(), model: "", input: 0, output: 0 }])} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              <Plus className="h-4 w-4" /> Añadir modelo
            </button>
          </div>
        </Card>
      </fieldset>
      {readOnly ? (
        <p className="text-sm text-ink-3">Tu rol (soporte) solo permite consultar la configuración.</p>
      ) : (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar configuración"}</Button>
          {state?.ok && <p role="status" className="text-sm text-success">Configuración guardada y auditada.</p>}
          {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        </div>
      )}
    </form>
  );
}
