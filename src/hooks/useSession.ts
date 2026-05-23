import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  emptySession,
  recordSelection,
  shouldEndForInactivity,
  shouldShowSoftCap,
  isRewardEligible,
  INACTIVITY_MS,
  SOFT_CAP_MS,
  type SessionState,
} from "@/lib/sessionState";

interface UseSessionOpts {
  pupilId: string | null;
  depth: number;
}

/**
 * Manages a single TA<->pupil session: lazy-starts on first selection, auto-ends
 * on inactivity, exposes a soft-cap signal at 10 minutes, awards the Golden Sign
 * on end if eligible. All side effects (DB writes) are best-effort.
 */
export function useSession({ pupilId, depth }: UseSessionOpts) {
  const [state, setState] = useState<SessionState>(() => emptySession());
  const [softCap, setSoftCap] = useState(false);
  const [rewardJustAwarded, setRewardJustAwarded] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const endSession = useCallback(async () => {
    const s = stateRef.current;
    if (!s.id || s.endedAt) return;
    const eligible = isRewardEligible(s);
    const endedAt = Date.now();
    setState((prev) => ({ ...prev, endedAt, goldenAwarded: eligible }));
    if (eligible) setRewardJustAwarded(true);
    await supabase
      .from("sessions")
      .update({
        ended_at: new Date(endedAt).toISOString(),
        scene_count: s.scenes.size,
        total_selections: s.totalSelections,
        golden_sign_awarded: eligible,
      })
      .eq("id", s.id);
  }, []);

  const recordTap = useCallback(
    async (sceneId: string) => {
      const now = Date.now();
      let sessionId = stateRef.current.id;
      if (!sessionId && pupilId) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("sessions")
          .insert({ pupil_id: pupilId, ta_id: user?.id ?? null, depth_used: depth })
          .select("id")
          .single();
        if (!error && data) sessionId = data.id;
      }
      setState((prev) => {
        const next = recordSelection(prev, sceneId, now);
        return sessionId ? { ...next, id: sessionId } : next;
      });
    },
    [pupilId, depth],
  );

  // Inactivity + soft-cap watcher.
  useEffect(() => {
    if (!state.id || state.endedAt) return;
    const tick = () => {
      const now = Date.now();
      if (shouldShowSoftCap(stateRef.current, now, SOFT_CAP_MS)) setSoftCap(true);
      if (shouldEndForInactivity(stateRef.current, now, INACTIVITY_MS)) endSession();
    };
    const handle = window.setInterval(tick, 15_000);
    return () => window.clearInterval(handle);
  }, [state.id, state.endedAt, endSession]);

  const acknowledgeReward = useCallback(() => setRewardJustAwarded(false), []);

  return useMemo(
    () => ({ state, softCap, rewardJustAwarded, recordTap, endSession, acknowledgeReward }),
    [state, softCap, rewardJustAwarded, recordTap, endSession, acknowledgeReward],
  );
}
