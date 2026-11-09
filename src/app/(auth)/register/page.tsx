import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return <Suspense><AuthForm mode="register" /></Suspense>;
}
