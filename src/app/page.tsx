import Link from "next/link";
import { BookOpenCheck, Brain, CalendarClock, FileText, Layers, Target } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";

const FEATURES = [
  { icon: FileText, title: "Tus apuntes, primero", text: "Sube PDF, Word o texto. Triff los organiza por temas y cita la página de cada respuesta." },
  { icon: Brain, title: "Tutora que enseña", text: "Explica, resuelve paso a paso o te guía con preguntas socráticas sin darte la solución." },
  { icon: CalendarClock, title: "Plan hasta el examen", text: "Reparte el temario según tu fecha, tu tiempo y lo que ya dominas. Se ajusta solo." },
  { icon: Layers, title: "Repaso espaciado", text: "Tarjetas con FSRS: repasas justo antes de olvidar, nunca después del examen." },
  { icon: BookOpenCheck, title: "Cuestionarios con fuente", text: "Opción múltiple y verdadero/falso con explicación y referencia a tus apuntes." },
  { icon: Target, title: "Dominio real", text: "Medimos tu dominio con evidencias de varios formatos, no con un único test." },
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className={buttonClass("ghost")}>Entrar</Link>
          <Link href="/register" className={buttonClass("primary")}>Crear cuenta</Link>
        </nav>
      </header>
      <main>
        <section className="rise py-16 sm:py-24">
          <p className="mb-4 inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">Profesora particular · Preparadora de exámenes</p>
          <h1 className="font-display max-w-3xl text-4xl leading-tight font-semibold sm:text-6xl">
            Estudia con alguien que conoce tu temario y sabe qué te falta.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-2">
            Triff convierte tus apuntes en un plan de estudio, explicaciones adaptadas, tarjetas y cuestionarios — y mide cuánto dominas cada tema hasta el día del examen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className={buttonClass("primary", "lg")}>Empezar gratis</Link>
            <Link href="/login" className={buttonClass("secondary", "lg")}>Ya tengo cuenta</Link>
          </div>
        </section>
        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6">
              <Icon className="mb-3 h-6 w-6 text-primary" aria-hidden />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-ink-2">{text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-8 text-sm text-ink-3">© {new Date().getFullYear()} Triff · Proyecto en desarrollo</footer>
    </div>
  );
}
