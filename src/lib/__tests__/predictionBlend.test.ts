import { describe, it, expect } from "vitest";
import { blend, pupilWeight, markovDistribution, banditDistribution } from "../predictionBlend";

describe("blend", () => {
  const markov = { a: 0.8, b: 0.2 };
  const bandit = { a: 0.1, b: 0.9 };

  it("w=0 returns pure bandit", () => {
    expect(blend(markov, bandit, 0)).toEqual(bandit);
  });

  it("w=1 returns pure markov", () => {
    expect(blend(markov, bandit, 1)).toEqual(markov);
  });

  it("w=0.5 averages the two", () => {
    const out = blend(markov, bandit, 0.5);
    expect(out.a).toBeCloseTo(0.45, 5);
    expect(out.b).toBeCloseTo(0.55, 5);
  });
});

describe("pupilWeight", () => {
  it("scales 0..1 with saturation at 50", () => {
    expect(pupilWeight(0)).toBe(0);
    expect(pupilWeight(25)).toBe(0.5);
    expect(pupilWeight(50)).toBe(1);
    expect(pupilWeight(500)).toBe(1);
  });
});

describe("markovDistribution", () => {
  it("falls back to uniform when no transitions are seen (Laplace smoothing)", () => {
    const dist = markovDistribution([], ["a", "b", "c"], "x");
    expect(dist.a).toBeCloseTo(1 / 3);
    expect(dist.b).toBeCloseTo(1 / 3);
    expect(dist.c).toBeCloseTo(1 / 3);
  });

  it("rewards the most recent / most frequent transition", () => {
    const now = new Date("2026-01-15T00:00:00Z");
    const dist = markovDistribution(
      [
        { from_card_id: "x", to_card_id: "a", count: 10, last_seen_at: "2026-01-14T00:00:00Z" },
        { from_card_id: "x", to_card_id: "b", count: 1, last_seen_at: "2026-01-14T00:00:00Z" },
      ],
      ["a", "b"],
      "x",
      now,
    );
    expect(dist.a).toBeGreaterThan(dist.b);
  });
});

describe("banditDistribution", () => {
  it("normalises Beta means across visible cards", () => {
    const out = banditDistribution(
      [
        { card_id: "a", alpha: 9, beta: 1 }, // mean ~0.9
        { card_id: "b", alpha: 1, beta: 9 }, // mean ~0.1
      ],
      ["a", "b"],
    );
    expect(out.a + out.b).toBeCloseTo(1, 5);
    expect(out.a).toBeGreaterThan(out.b);
  });
});
