/**
 * Mastery estimation from heterogeneous evidence.
 *
 * Not a raw quiz percentage: each observation is weighted by how informative
 * its format is (a true/false guess is worth less than a recalled flashcard or
 * a solved exercise), corrected for chance, and decayed with age so that old
 * successes don't hide current forgetting. "Dominado" additionally requires
 * enough evidence AND at least two different formats.
 */

export type EvidenceKind = "flashcard" | "mcq" | "true_false" | "exercise" | "tutor";

export type Evidence = { kind: EvidenceKind | string; score: number; createdAt: Date };

export type MasteryLevel = "not_started" | "beginner" | "developing" | "almost" | "mastered";

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  not_started: "No iniciado",
  beginner: "Principiante",
  developing: "En desarrollo",
  almost: "Casi dominado",
  mastered: "Dominado",
};

const WEIGHT: Record<string, number> = {
  exercise: 1.5,
  flashcard: 1,
  mcq: 0.8,
  true_false: 0.4,
  tutor: 0.5,
};

/** Chance level per format (score expected from pure guessing). */
const GUESS: Record<string, number> = { mcq: 0.25, true_false: 0.5 };

const HALF_LIFE_DAYS = 21;
const MIN_WEIGHT_FOR_MASTERED = 4;
const MIN_WEIGHT_FOR_GAP = 2.5;

export type MasteryEstimate = {
  p: number; // estimated probability of mastery 0..1
  confidence: number; // effective evidence weight
  level: MasteryLevel;
  kinds: number;
  isGap: boolean;
};

function chanceCorrected(kind: string, score: number) {
  const g = GUESS[kind] ?? 0;
  if (g === 0) return score;
  return Math.max(0, (score - g) / (1 - g));
}

export function estimateMastery(evidence: Evidence[], now = new Date()): MasteryEstimate {
  if (evidence.length === 0) {
    return { p: 0, confidence: 0, level: "not_started", kinds: 0, isGap: false };
  }
  // Beta(1,2) prior (mean 0.33): knowledge is not assumed until evidence shows it,
  // so a single good quiz cannot inflate mastery.
  let num = 1;
  let den = 3;
  let confidence = 0;
  const kinds = new Set<string>();
  for (const e of evidence) {
    const ageDays = Math.max(0, (now.getTime() - e.createdAt.getTime()) / 86_400_000);
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const w = (WEIGHT[e.kind] ?? 0.5) * decay;
    num += w * chanceCorrected(e.kind, Math.min(1, Math.max(0, e.score)));
    den += w;
    confidence += w;
    kinds.add(e.kind);
  }
  const p = num / den;
  let level: MasteryLevel;
  if (p < 0.4) level = "beginner";
  else if (p < 0.6) level = "developing";
  else if (p < 0.8) level = "almost";
  else level = confidence >= MIN_WEIGHT_FOR_MASTERED && kinds.size >= 2 ? "mastered" : "almost";

  // A gap is a *consolidated* weakness: low estimate backed by enough evidence,
  // never a single wrong answer.
  const isGap = p < 0.4 && confidence >= MIN_WEIGHT_FOR_GAP;
  return { p, confidence, level, kinds: kinds.size, isGap };
}

export type NextStep =
  | { action: "learn"; reason: string }
  | { action: "practice"; reason: string }
  | { action: "explain_differently"; reason: string }
  | { action: "assess"; reason: string }
  | { action: "advance"; reason: string };

/** Decision policy of the adaptive engine for a single topic. */
export function decideNextStep(m: MasteryEstimate, recentScores: number[]): NextStep {
  if (m.level === "not_started") return { action: "learn", reason: "Aún no hay evidencias sobre este tema." };
  const lastThree = recentScores.slice(-3);
  const failingStreak = lastThree.length === 3 && lastThree.every((s) => s < 0.5);
  if (failingStreak)
    return {
      action: "explain_differently",
      reason: "Tres intentos seguidos por debajo del 50 %: conviene otra explicación antes de seguir practicando.",
    };
  if (m.level === "mastered") return { action: "advance", reason: "Dominio consolidado con evidencias de varios formatos." };
  if (m.level === "almost" && m.kinds < 2)
    return { action: "assess", reason: "Buen resultado, pero solo en un formato: hace falta comprobarlo de otra forma." };
  if (m.level === "almost" && m.confidence < MIN_WEIGHT_FOR_MASTERED)
    return { action: "assess", reason: "Buen resultado con pocas evidencias: una evaluación breve lo confirmará." };
  return { action: "practice", reason: `Dominio estimado del ${Math.round(m.p * 100)} %: falta práctica.` };
}
