import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isResponse, jsonError } from "@/lib/http";
import { getOwnedSubject } from "@/lib/services/documents";
import { generateQuiz } from "@/lib/services/generation";

const body = z.object({ topicId: z.uuid().nullish(), count: z.number().int().min(3).max(30).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guard(req, { limit: 6 });
  if (isResponse(user)) return user;
  const { id } = await params;
  if (!(await getOwnedSubject(user.id, id))) return jsonError("Asignatura no encontrada", 404);
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Parámetros no válidos");
  try {
    return NextResponse.json(await generateQuiz(user, id, parsed.data));
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return jsonError(status === 429 ? (e as Error).message : "No se han podido generar el cuestionario", status);
  }
}
