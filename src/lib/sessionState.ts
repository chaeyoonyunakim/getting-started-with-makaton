/**
 * Pure session-state reducer + reward eligibility test.
 * Kept framework-free so it's straightforward to unit-test.
 */

export interface SessionState {
  id: string | null;
  startedAt: number | null;
  lastActivityAt: number | null;
  endedAt: number | null;
  totalSelections: number;
  scenes: Set<string>;
  goldenAwarded: boolean;
}

export interface RewardCriteria {
  minSelections: number;
  minDistinctScenes: number;
}

export const DEFAULT_REWARD: RewardCriteria = { minSelections: 5, minDistinctScenes: 2 };
export const SOFT_CAP_MS = 10 * 60 * 1000; // 10 minutes
export const INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes

export function emptySession(): SessionState {
  return {
    id: null,
    startedAt: null,
    lastActivityAt: null,
    endedAt: null,
    totalSelections: 0,
    scenes: new Set<string>(),
    goldenAwarded: false,
  };
}

export function recordSelection(
  state: SessionState,
  sceneId: string,
  at: number,
): SessionState {
  const scenes = new Set(state.scenes);
  scenes.add(sceneId);
  return {
    ...state,
    startedAt: state.startedAt ?? at,
    lastActivityAt: at,
    totalSelections: state.totalSelections + 1,
    scenes,
  };
}

export function shouldEndForInactivity(state: SessionState, now: number, inactivityMs = INACTIVITY_MS) {
  if (state.lastActivityAt === null || state.endedAt !== null) return false;
  return now - state.lastActivityAt >= inactivityMs;
}

export function shouldShowSoftCap(state: SessionState, now: number, softCapMs = SOFT_CAP_MS) {
  if (state.startedAt === null || state.endedAt !== null) return false;
  return now - state.startedAt >= softCapMs;
}

export function isRewardEligible(state: SessionState, criteria: RewardCriteria = DEFAULT_REWARD) {
  return (
    state.totalSelections >= criteria.minSelections &&
    state.scenes.size >= criteria.minDistinctScenes
  );
}
