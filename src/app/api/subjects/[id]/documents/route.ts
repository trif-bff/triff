import { NextResponse } from "next/server";
import { guard, isResponse, jsonError } from "@/lib/http";
import { ingestDocument, UploadError } from "@/lib/services/documents";
import { regeneratePlan } from "@/lib/services/progress";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guard(req, { limit: 10 });
  if (isResponse(user)) return user;
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError("Falta el archivo");
  try {
    const result = await ingestDocument({
      userId: user.id,
      subjectId: id,
      filename: file.name,
      declaredType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    await regeneratePlan(user.id, id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof UploadError) return jsonError(e.message, e.status);
    console.error(e);
    return jsonError("Error inesperado", 500);
  }
}
