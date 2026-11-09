import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildExamReport, isLate, LATE_GRACE_SEC } from "@/lib/learning/exam-report";
import { allocateByImportance, extractDefinitions, mockExamFromDefinitions, type SourceChunk } from "@/lib/learning/heuristic";
import { chunkPages, normalizeTitle } from "@/lib/docs/chunk";

describe("allocateByImportance", () => {
  const topics = [
    { id: "a", importance: 2, available: 10 },
    { id: "b", importance: 1, available: 10 },
    { id: "c", importance: 1, available: 1 },
  ];
  it("distributes exactly the requested total", () => {
    const m = allocateByImportance(topics, 12);
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(12);
  });
  it("is proportional to importance and respects availability", () => {
    const m = allocateByImportance(topics, 12);
    expect(m.get("a")!).toBeGreaterThan(m.get("b")!);
    expect(m.get("c")).toBe(1);
  });
  it("covers every topic with material when possible", () => {
    const m = allocateByImportance([...topics, { id: "d", importance: 0.1, available: 3 }], 4);
    expect([...m.values()].every((n) => n >= 1)).toBe(true);
  });
  it("never exceeds the available material", () => {
    const m = allocateByImportance(topics, 100);
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(21);
    expect(m.get("c")).toBe(1);
  });
  it("ignores topics without material", () => {
    expect(allocateByImportance([{ id: "x", importance: 5, available: 0 }], 5).get("x")).toBeUndefined();
  });
});

describe("mockExamFromDefinitions", () => {
  const notes = readFileSync(new URL("../fixtures/contabilidad.md", import.meta.url), "utf8");
  const { chunks } = chunkPages([notes]);
  const ids = new Map(chunks.map((c) => [normalizeTitle(c.heading!), `t-${normalizeTitle(c.heading!).slice(0, 8)}`]));
  const src: SourceChunk[] = chunks.map((c, i) => ({ id: `c${i}`, content: c.content, heading: c.heading, topicId: ids.get(normalizeTitle(c.heading!)) }));
  const defs = extractDefinitions(src);
  const topics = [...new Set(ids.values())].map((id, i) => ({ id, importance: i === 0 ? 2 : 1 }));

  it("covers every topic and interleaves them", () => {
    const qs = mockExamFromDefinitions(defs, topics, 8, 3);
    expect(qs.length).toBe(8);
    expect(new Set(qs.map((q) => q.topicId)).size).toBe(topics.length);
    const sameAsPrev = qs.slice(1).filter((q, i) => q.topicId === qs[i].topicId).length;
    expect(sameAsPrev).toBeLessThan(qs.length - 1);
  });
  it("produces valid items even for topics with a single definition (distractors borrowed)", () => {
    for (const q of mockExamFromDefinitions(defs, topics, 12, 9)) {
      expect(q.correct.every((i) => i < q.options.length)).toBe(true);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});

describe("buildExamReport", () => {
  const t0 = new Date("2026-05-01T10:00:00Z");
  const items = [
    { topicId: "a", topicTitle: "A", score: 1, answered: true },
    { topicId: "a", topicTitle: "A", score: 1, answered: true },
    { topicId: "b", topicTitle: "B", score: 0, answered: true },
    { topicId: "b", topicTitle: "B", score: 0, answered: false },
  ];
  it("grades on a 0–10 scale with per-topic breakdown, weakest first", () => {
    const r = buildExamReport({ items, previousGrades: [], startedAt: t0, submittedAt: new Date(t0.getTime() + 600_000), limitSec: 1200, targetGrade: 7 });
    expect(r.grade).toBe(5);
    expect(r.answered).toBe(3);
    expect(r.byTopic[0].title).toBe("B");
    expect(r.weakest.map((w) => w.title)).toEqual(["B"]);
    expect(r.late).toBe(false);
    expect(r.usedSec).toBe(600);
    expect(r.verdict).toMatch(/a 2 puntos de tu objetivo/);
  });
  it("compares with the previous mock", () => {
    const r = buildExamReport({ items, previousGrades: [6.5, 3], startedAt: t0, submittedAt: t0, limitSec: 60 });
    expect(r.trend).toEqual({ previous: 6.5, delta: -1.5 });
  });
  it("flags late submissions only after the grace period", () => {
    expect(isLate(t0, 60, new Date(t0.getTime() + (60 + LATE_GRACE_SEC) * 1000))).toBe(false);
    expect(isLate(t0, 60, new Date(t0.getTime() + (61 + LATE_GRACE_SEC) * 1000))).toBe(true);
  });
});
