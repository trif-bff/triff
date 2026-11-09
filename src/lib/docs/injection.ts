/**
 * Prompt-injection hygiene for student-uploaded documents.
 *
 * Defence in depth — detection is NOT the main control:
 *  1. Document text only ever enters the model inside <source> data blocks,
 *     after the system prompt states that sources are data, never instructions.
 *  2. The tutor has no tools with side effects (no external actions, no writes
 *     outside the student's own records), so a successful injection can at most
 *     degrade one answer.
 *  3. This module flags suspicious chunks so the UI can warn and the prompt can
 *     mark them; it also neutralises tags that could close our data wrapper.
 */

const PATTERNS: RegExp[] = [
  /ignor(e|a|ar)\s+(all\s+|todas?\s+las?\s+)?(previous|prior|above|anteriores?)\s+(instructions|instrucciones|indicaciones)/i,
  /disregard\s+(the\s+)?(system|previous)\s+(prompt|instructions)/i,
  /olvida\s+(todas?\s+)?(tus|las)\s+instrucciones/i,
  /\b(system\s*prompt|prompt\s+del\s+sistema)\b/i,
  /you\s+are\s+now\s+(a|an|the)\b/i,
  /a\s+partir\s+de\s+ahora\s+(eres|act[uú]a)/i,
  /\bact\s+as\s+(an?\s+)?(unrestricted|jailbroken|dan)\b/i,
  /<\/?\s*(system|assistant|instructions?|source|tool)\b[^>]*>/i,
  /\b(reveal|print|muestra|revela)\s+(your|tu|el)\s+(system\s+)?(prompt|instrucciones)/i,
  /\b(send|env[ií]a)\b.{0,40}\b(https?:\/\/|e-?mail|correo)/i,
];

export function scanForInjection(text: string): { suspicious: boolean; hits: number } {
  let hits = 0;
  for (const re of PATTERNS) if (re.test(text)) hits++;
  return { suspicious: hits > 0, hits };
}

/** Escape anything that could break out of the <source> wrapper. */
export function neutralize(text: string): string {
  return text.replace(/<\s*\/?\s*(source|system|assistant|user|instructions?|tool)[^>]*>/gi, (m) =>
    m.replace(/</g, "‹").replace(/>/g, "›"),
  );
}
