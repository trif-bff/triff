import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, isResponse, jsonError } from "@/lib/http";
import { createMockExam, ExamError, MOCK_LIMITS } from "@/lib/services/exams";

const body = z.object({
  questions: z.number().int().min(MOCK_LIMITS.minQuestions).max(MOCK_LIMITS.maxQuestions).default(20),
  minutes: z.number().int().min(MOCK_LIMITS.minMinutes).max(MOCK_LIMITS.maxMinutes).default(30),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guard(req, { limit: 6 });
  if (isResponse(user)) return user;
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Parámetros no válidos");
  try {
    return NextResponse.json(await createMockExam(user.id, id, parsed.data), { status: 201 });
  } catch (e) {
    if (e instanceof ExamError) return jsonError(e.message, e.status);
    console.error(e);
    return jsonError("No se ha podido crear el simulacro", 500);
  }
}
