import { useEffect, useState } from "react";
import { useStudent } from "@/contexts/StudentContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true iff the currently-active pupil is at a Makaton-licensed school.
 * Drives whether the literal word "Makaton" can appear in UI copy.
 */
export function useMakatonLicensed() {
  const { currentPupilId } = useStudent();
  const [licensed, setLicensed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!currentPupilId) {
      setLicensed(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("pupils")
        .select("makaton_licensed")
        .eq("id", currentPupilId)
        .maybeSingle();
      if (!cancelled) setLicensed(!!data?.makaton_licensed);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPupilId]);

  return licensed;
}

/** Helper for symbol-related copy. */
export const signNoun = (licensed: boolean) => (licensed ? "Makaton sign" : "sign");
