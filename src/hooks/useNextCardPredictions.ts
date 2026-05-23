import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PredictedChoice {
  cardId: string;
  probability: number;
  reason: string;
}

/**
 * Calls the `predictNextCards` edge function and returns the top-3 predicted
 * cardIds for the given (pupil, scene, currentCard) tuple. Failures are
 * swallowed silently so the board never blocks on the predictor.
 */
export function useNextCardPredictions(
  pupilId: string | null | undefined,
  sceneId: string | null | undefined,
  currentCardId: string | null | undefined,
) {
  const [top3, setTop3] = useState<PredictedChoice[]>([]);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const ids = useMemo(() => ({ pupilId, sceneId, currentCardId }), [pupilId, sceneId, currentCardId]);

  useEffect(() => {
    let cancelled = false;
    if (!ids.pupilId || !ids.sceneId) {
      setTop3([]);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("predictNextCards", {
          body: {
            pupilId: ids.pupilId,
            sceneId: ids.sceneId,
            currentCardId: ids.currentCardId ?? null,
            sessionId: sessionIdRef.current,
          },
        });
        if (error || cancelled) return;
        setTop3(((data as any)?.top3 ?? []) as PredictedChoice[]);
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const topIds = useMemo(() => new Set(top3.map((t) => t.cardId)), [top3]);
  return { top3, topIds };
}
