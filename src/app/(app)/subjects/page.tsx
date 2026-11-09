import Link from "next/link";
import { createSubject } from "../actions";
import { SubjectForm } from "@/components/subject-form";
import { Card, Empty, ProgressRing, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { subjectSummaries } from "@/lib/services/recommend";

export const metadata = { title: "Asignaturas" };

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const [summaries, sp] = await Promise.all([subjectSummaries(user.id), searchParams]);
  const showForm = sp.new === "1" || summaries.length === 0;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold">Asignaturas</h1>
        <p className="text-ink-2">Cada asignatura tiene su temario, sus apuntes, su plan y su nivel de dominio.</p>
      </header>
      {showForm ? (
        <Card className="rise">
          <h2 className="mb-4 font-semibold">Preparar un examen</h2>
          <SubjectForm action={createSubject} />
        </Card>
      ) : (
        <Link href="/subjects?new=1" className="inline-block text-sm font-medium text-primary">+ Nueva asignatura</Link>
      )}
      <section>
        <SectionTitle>Tus asignaturas</SectionTitle>
        {summaries.length === 0 ? (
          <Empty title="Aún no hay asignaturas" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {summaries.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card flex items-center gap-4 p-5 hover:border-primary/40">
                <ProgressRing value={s.mastery} size={64} label={`Dominio de ${s.name}`} />
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-ink-3">{s.level ?? "Sin nivel"} · {s.documents} documentos · {s.topics.length} temas</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
