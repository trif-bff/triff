import { describe, expect, it } from "vitest";
import {
  capActivityXp,
  challengeProgress,
  computeStreak,
  DAILY_ACTIVITY_CAP,
  earnedBadges,
  levelFromXp,
  pickChallenges,
  transitionRewards,
  xpForLevel,
  XP,
} from "@/lib/learning/gamification";

const days = (...d: string[]) => new Set(d);

describe("levels", () => {
  it("grows gently and reports progress to the next level", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(levelFromXp(0)).toMatchObject({ level: 1, intoLevel: 0, toNext: 100 });
    expect(levelFromXp(150)).toMatchObject({ level: 2, intoLevel: 50, toNext: 150, progress: 0.25 });
    expect(levelFromXp(xpForLevel(10)).title).toBe("Experta/o");
  });
});

describe("activity cap", () => {
  it("caps activity XP per day", () => {
    expect(capActivityXp(10, 0)).toBe(10);
    expect(capActivityXp(10, DAILY_ACTIVITY_CAP - 4)).toBe(4);
    expect(capActivityXp(10, DAILY_ACTIVITY_CAP + 5)).toBe(0);
  });
});

describe("streak with rest days", () => {
  it("counts consecutive days and does not break before today's session", () => {
    expect(computeStreak(days("2026-03-08", "2026-03-09", "2026-03-10"), "2026-03-10").streak).toBe(3);
    expect(computeStreak(days("2026-03-08", "2026-03-09"), "2026-03-10").streak).toBe(2);
  });
  it("forgives one rest day per week", () => {
    const r = computeStreak(days("2026-03-06", "2026-03-07", "2026-03-09", "2026-03-10"), "2026-03-10");
    expect(r.streak).toBe(4);
    expect(r.restDaysUsed).toBe(1);
    expect(r.restAvailable).toBe(false);
  });
  it("breaks with two rest days in the same week or two missed days in a row", () => {
    expect(computeStreak(days("2026-03-04", "2026-03-06", "2026-03-08", "2026-03-09", "2026-03-10"), "2026-03-10").streak).toBe(4);
    expect(computeStreak(days("2026-03-05", "2026-03-06", "2026-03-09", "2026-03-10"), "2026-03-10").streak).toBe(2);
  });
  it("allows a new rest day once a week has passed", () => {
    const active = new Set<string>();
    for (let d = 1; d <= 20; d++) if (d !== 3 && d !== 12) active.add(`2026-03-${String(d).padStart(2, "0")}`);
    expect(computeStreak(active, "2026-03-20").streak).toBe(18);
  });
  it("is zero without activity", () => {
    expect(computeStreak(days(), "2026-03-10").streak).toBe(0);
  });
});

describe("daily challenges", () => {
  const state = { dueCards: 30, hasDocuments: true, weakestTopic: { id: "t1", title: "Amortización" }, planTopics: ["t1", "t2", "t3"] };
  it("adapts to the student's situation", () => {
    const cs = pickChallenges(state);
    expect(cs.map((c) => c.kind)).toEqual(["reviews", "weak_topic_quiz", "plan_topics"]);
    expect(cs[0].target).toBe(15);
    expect(pickChallenges({ ...state, dueCards: 0 })[0].kind).toBe("any_practice");
    expect(pickChallenges({ ...state, hasDocuments: false })[0].kind).toBe("upload");
  });
  it("measures progress only from real activity", () => {
    const [reviews, weak, plan] = pickChallenges(state);
    const ev = [
      { topicId: "t1", kind: "flashcard", score: 1 },
      { topicId: "t1", kind: "mcq", score: 1 },
      { topicId: "t1", kind: "mcq", score: 0 },
      { topicId: "t1", kind: "true_false", score: 1 },
      { topicId: "t2", kind: "flashcard", score: 0.85 },
    ];
    expect(challengeProgress(reviews, ev, 0, state.planTopics)).toBe(2);
    expect(challengeProgress(weak, ev, 0, state.planTopics)).toBe(60); // 67 % capped at target
    expect(challengeProgress(weak, ev.slice(0, 3), 0, state.planTopics)).toBe(0); // fewer than 3 questions
    expect(challengeProgress(plan, ev, 0, state.planTopics)).toBe(2);
  });
});

describe("badges", () => {
  const none = { documents: 0, mocks: 0, mockImproved: false, topicsMastered: 0, gapsRecovered: 0, streak: 0, reviews: 0, fullCoverage: false, examReady: false };
  it("awards badges from achievements, not from time", () => {
    expect(earnedBadges(none)).toEqual([]);
    expect(earnedBadges({ ...none, documents: 1, streak: 8, reviews: 120 })).toEqual(["first_upload", "streak_7", "reviews_100"]);
  });
});

describe("mastery transition rewards", () => {
  it("rewards each new level once and never the trivial first step", () => {
    const r = transitionRewards([{ topicId: "a", from: "not_started", to: "almost", gapBefore: false, gapAfter: false }]);
    expect(r.map((x) => x.key)).toEqual(["level:a:developing", "level:a:almost"]);
    expect(r.every((x) => x.amount === XP.levelUp)).toBe(true);
  });
  it("gives a bigger reward for mastery and for recovering a gap", () => {
    const r = transitionRewards([{ topicId: "b", from: "almost", to: "mastered", gapBefore: true, gapAfter: false }]);
    expect(r).toEqual([
      { kind: "mastered", amount: XP.mastered, key: "level:b:mastered", topicId: "b" },
      { kind: "gap_recovered", amount: XP.gapRecovered, key: "gap:b", topicId: "b" },
    ]);
  });
  it("gives nothing for going down", () => {
    expect(transitionRewards([{ topicId: "c", from: "almost", to: "developing", gapBefore: false, gapAfter: true }])).toEqual([]);
  });
});
