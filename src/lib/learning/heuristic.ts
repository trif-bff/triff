/**
 * Source-grounded generation without an LLM.
 *
 * Used when no AI provider is configured, and as a cheap first pass. It only
 * extracts what is literally in the student's notes (definitions of the form
 * "X es…", "X: …", "Se denomina X…"), so it can never invent content. Quality
 * is lower than LLM generation and the UI labels it as "extracción literal".
 */

export type SourceChunk = { id: string; content: string; heading: string | null; topicId?: string | null };
export type Definition = { term: string; definition: string; sentence: string; chunkId: string; topicId: string | null };

const STOP_TERMS = new Set([
  "esto", "eso", "ello", "este", "esta", "lo", "la", "el", "que", "cual", "también", "además",
  "no", "sí", "hay", "es", "ejemplo", "nota", "importante", "resultado", "solución", "respuesta",
]);

function sentences(text: string): string[] {
  return (text.replace(/\n(?!\n)/g, " ").match(/[^.!?\n]+[.!?]/g) ?? []).map((s) => s.trim());
}

function cleanTerm(t: string) {
  const term = t
    .replace(/^[-•*\d.)\s]+/, "")
    .replace(/^(el|la|los|las|un|una)\s+/i, "")
    .replace(/\s+(es|son|será|era)$/i, "") // "La ecuación fundamental es: …"
    .trim();
  return capitalize(term);
}

function validTerm(term: string) {
  const words = term.split(/\s+/);
  return (
    term.length >= 3 && term.length <= 60 && words.length <= 6 &&
    !STOP_TERMS.has(term.toLowerCase()) && /^[A-Za-zÁÉÍÓÚÑáéíóúñü]/.test(term) && !/[,;]/.test(term)
  );
}

export function extractDefinitions(chunks: SourceChunk[]): Definition[] {
  const out: Definition[] = [];
  const seen = new Set<string>();
  const push = (term: string, definition: string, sentence: string, c: SourceChunk) => {
    term = cleanTerm(term);
    definition = definition.trim().replace(/\s+/g, " ");
    const key = term.toLowerCase();
    if (!validTerm(term) || definition.length < 15 || definition.length > 400 || seen.has(key)) return;
    seen.add(key);
    out.push({ term, definition, sentence, chunkId: c.id, topicId: c.topicId ?? null });
  };

  for (const c of chunks) {
    // "Término: definición" on its own line (glossary style)
    for (const line of c.content.split("\n")) {
      const m = line.match(/^\s*(?:[-•*]\s*)?([A-ZÁÉÍÓÚÑ][^:\n]{2,58}):\s+(.{15,400})$/);
      if (m) push(m[1], m[2], line.trim(), c);
    }
    for (const s of sentences(c.content)) {
      let m = s.match(/^(?:(?:El|La|Los|Las|Un|Una)\s+)?([A-ZÁÉÍÓÚÑa-záéíóúñ][\wáéíóúñü\s-]{2,58}?)\s+(?:es|son)\s+((?:un|una|el|la|los|las|aquel|aquella|aquellos|aquellas|lo|todo|toda)\s.{10,380})$/);
      if (m) { push(m[1], m[2], s, c); continue; }
      m = s.match(/^Se\s+(?:denomina|llama|conoce\s+como|define\s+como)\s+(.{3,60}?)\s+(?:a|al|a\s+la|a\s+los|a\s+las)\s+(.{10,380})$/i);
      if (m) { push(m[1], m[2], s, c); continue; }
      m = s.match(/^(?:(?:El|La|Los|Las)\s+)?(.{3,58}?)\s+se\s+define\s+como\s+(.{10,380})$/);
      if (m) push(m[1], m[2], s, c);
    }
  }
  return out;
}

export type GeneratedCard = { front: string; back: string; chunkId: string; topicId: string | null };

export function cardsFromDefinitions(defs: Definition[], max = 30): GeneratedCard[] {
  return defs.slice(0, max).map((d) => ({
    front: `¿Qué es «${d.term}»?`,
    back: capitalize(d.definition.replace(/\.$/, "")) + ".",
    chunkId: d.chunkId,
    topicId: d.topicId,
  }));
}

export type GeneratedQuestion = {
  type: "mcq" | "true_false";
  prompt: string;
  options: string[];
  correct: number[];
  explanation: string;
  chunkId: string;
  topicId: string | null;
};

/** Deterministic PRNG so tests and regenerations are reproducible. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

function shuffle<T>(arr: T[], rnd: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function short(s: string, n = 160) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function questionsFromDefinitions(defs: Definition[], count = 10, seed = 42): GeneratedQuestion[] {
  if (defs.length < 2) return [];
  const rnd = seeded(seed);
  const pool = shuffle(defs, rnd);
  const qs: GeneratedQuestion[] = [];
  for (let i = 0; i < pool.length && qs.length < count; i++) {
    const d = pool[i];
    const others = shuffle(defs.filter((x) => x !== d), rnd);
    const cite = `Según tus apuntes: «${short(d.sentence, 220)}»`;
    const useMcq = defs.length >= 4 && (qs.length % 3 !== 2);
    if (useMcq) {
      const distractors = others.slice(0, 3).map((o) => o.term);
      const options = shuffle([d.term, ...distractors], rnd);
      qs.push({
        type: "mcq",
        prompt: `¿Qué concepto corresponde a esta definición? «${short(capitalize(d.definition))}»`,
        options,
        correct: [options.indexOf(d.term)],
        explanation: cite,
        chunkId: d.chunkId,
        topicId: d.topicId,
      });
    } else {
      const isTrue = rnd() < 0.5;
      const shown = isTrue ? d.definition : others[0].definition;
      qs.push({
        type: "true_false",
        prompt: `Verdadero o falso: «${d.term}» es ${short(shown)}`,
        options: ["Verdadero", "Falso"],
        correct: [isTrue ? 0 : 1],
        explanation: isTrue
          ? cite
          : `Falso: esa es la definición de «${others[0].term}». ${cite}`,
        chunkId: d.chunkId,
        topicId: d.topicId,
      });
    }
  }
  return qs;
}
