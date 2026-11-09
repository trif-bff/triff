import { SettingsForm } from "@/components/admin/settings-form";
import { can } from "@/lib/admin/permissions";
import { requirePermission } from "@/lib/auth/staff";
import { systemStatus } from "@/lib/services/admin";

export const metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const me = await requirePermission("settings.view");
  const sys = await systemStatus(me);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Configuración</h1>
        <p className="text-sm text-ink-3">Cambios efectivos en menos de 30 segundos. Cada cambio queda registrado en la auditoría con el valor anterior y el nuevo.</p>
      </header>
      <SettingsForm settings={sys.settings} readOnly={!can(me.role, "settings.manage")} providers={sys.providers} />
    </div>
  );
}
