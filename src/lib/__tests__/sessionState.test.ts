import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  emptySession,
  recordSelection,
  shouldEndForInactivity,
  shouldShowSoftCap,
  isRewardEligible,
  INACTIVITY_MS,
  SOFT_CAP_MS,
} from "../sessionState";

describe("sessionState", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("tracks selections and unique scenes", () => {
    let s = emptySession();
    s = recordSelection(s, "food", 1000);
    s = recordSelection(s, "food", 2000);
    s = recordSelection(s, "play", 3000);
    expect(s.totalSelections).toBe(3);
    expect(s.scenes.size).toBe(2);
    expect(s.startedAt).toBe(1000);
    expect(s.lastActivityAt).toBe(3000);
  });

  it("ends after 3 min of inactivity", () => {
    const s = recordSelection(emptySession(), "food", 0);
    expect(shouldEndForInactivity(s, INACTIVITY_MS - 1)).toBe(false);
    expect(shouldEndForInactivity(s, INACTIVITY_MS)).toBe(true);
  });

  it("shows soft cap after 10 min", () => {
    const s = recordSelection(emptySession(), "food", 0);
    expect(shouldShowSoftCap(s, SOFT_CAP_MS - 1)).toBe(false);
    expect(shouldShowSoftCap(s, SOFT_CAP_MS)).toBe(true);
  });

  it("rewards only when both selection AND scene thresholds met", () => {
    let s = emptySession();
    // 5 selections in 1 scene -> not enough
    for (let i = 0; i < 5; i++) s = recordSelection(s, "food", i * 100);
    expect(isRewardEligible(s)).toBe(false);
    // add a second scene
    s = recordSelection(s, "play", 1000);
    expect(isRewardEligible(s)).toBe(true);
  });

  it("rejects when only one of the thresholds is met", () => {
    let s = emptySession();
    s = recordSelection(s, "food", 0);
    s = recordSelection(s, "play", 100);
    expect(isRewardEligible(s)).toBe(false); // 2 scenes, only 2 selections
  });
});
