import { ResetPasswordForm } from "@/components/password-forms";

export const metadata = { title: "Nueva contraseña" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(token);
  return <ResetPasswordForm token={valid ? token! : null} invalid={Boolean(error)} />;
}
