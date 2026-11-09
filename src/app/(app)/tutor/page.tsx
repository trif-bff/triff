import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { TutorChat } from "@/components/tutor-chat";
import { requireUser } from "@/lib/auth/session";
import { isAiEnabled } from "@/lib/ai/provider";
import { getSettings } from "@/lib/services/settings";
import { TUTOR_MODES, type TutorMode } from "@/lib/ai/prompts";

export const metadata = { title: "Tutora" };

export default async function TutorPage({ searchParams }: { searchParams: Promise<{ subject?: string; mode?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const list = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.userId, user.id));
  const mode = (TUTOR_MODES as readonly string[]).includes(sp.mode ?? "") ? (sp.mode as TutorMode) : "explain";
  const subjectId = list.some((s) => s.id === sp.subject) ? sp.subject! : (list[0]?.id ?? "");
  return <TutorChat subjects={list} initialSubject={subjectId} initialMode={mode} initialQuestion={sp.q?.slice(0, 500) ?? ""} aiEnabled={isAiEnabled((await getSettings()).ai)} />;
}
