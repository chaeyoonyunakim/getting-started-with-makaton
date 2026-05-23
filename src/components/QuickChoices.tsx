import { useState, useEffect } from "react";
import { Loader2, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStudent } from "@/contexts/StudentContext";
import MakatonPlaceholder from "@/components/MakatonPlaceholder";

interface PredictedSign {
  label: string;
  imagePath?: string;
}

interface QuickChoicesProps {
  category?: string;
  highContrast: boolean;
  historyLog: string[];
  onSelect: (label: string) => void;
}

/** Attempt to resolve a label to a local symbol image */
const resolveImage = (label: string): string | undefined => {
  const name = label.toLowerCase().replace(/\s+/g, " ");
  return `/symbols/${name}.png`;
};

const QuickChoices = ({ category, highContrast, historyLog, onSelect }: QuickChoicesProps) => {
  const { currentStudent, currentPupilId, isProfileSet } = useStudent();
  const [predictions, setPredictions] = useState<PredictedSign[]>([]);
  const [loading, setLoading] = useState(false);

  const isFirstSession = historyLog.length === 0;

  useEffect(() => {
    if (!isProfileSet) return;

    let cancelled = false;
    const fetchPredictions = async () => {
      setLoading(true);
      setPredictions([]);
      try {
        const { data, error } = await supabase.functions.invoke("makaton-predict", {
          body: {
            child_name: currentPupilId ?? "pupil",
            category: category || "",
            history_log: historyLog.length > 0 ? historyLog : ["general"],
            is_first_session: isFirstSession,
          },
        });
        if (error) throw error;

        const raw: any[] =
          data?.predicted_signs ||
          data?.predictions ||
          data?.signs ||
          (Array.isArray(data) ? data : []);

        const signs: PredictedSign[] = raw.slice(0, 3).map((s: any) => {
          const label = typeof s === "string" ? s : s?.sign_name || s?.label || s?.name || String(s);
          return { label, imagePath: resolveImage(label) };
        });

        if (!cancelled) {
          setPredictions(signs);
        }
      } catch {
        if (!cancelled) setPredictions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPredictions();
    return () => { cancelled = true; };
  }, [currentStudent, category, isProfileSet, historyLog.length, isFirstSession]);

  const handleClick = (sign: PredictedSign) => {
    onSelect(sign.label);
  };

  if (!isProfileSet) return null;
  if (!loading && predictions.length === 0) return null;

  // First-session buttons are larger with a purple accent border + star badge
  const buttonSize = isFirstSession
    ? "w-24 h-24 sm:w-28 sm:h-28"
    : "w-20 h-20 sm:w-24 sm:h-24";

  const borderStyle = isFirstSession
    ? highContrast
      ? "border-[5px] border-black bg-card"
      : "border-[4px] border-purple-400 bg-card"
    : highContrast
      ? "border-[5px] border-black bg-card"
      : "border-3 border-primary/40 bg-card";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 animate-fade-in">
      <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        {isFirstSession ? (
          <>
            <Star className="w-4 h-4 text-purple-500 fill-purple-500" />
            Essentials for {currentStudent}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-primary" />
            Suggested for {currentStudent}
          </>
        )}
      </p>

      <div className="flex gap-3 justify-start">
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {isFirstSession ? "Loading essentials…" : "Predicting…"}
            </span>
          </div>
        ) : (
          predictions.map((sign) => (
            <div key={sign.label} className="relative">
              <button
                onClick={() => handleClick(sign)}
                className={`
                  ${buttonSize} rounded-full
                  ${borderStyle}
                  shadow-md overflow-hidden
                  flex items-center justify-center
                  transition-all duration-150
                  hover:scale-110 active:scale-95
                  focus:outline-none focus:ring-4 focus:ring-ring/50
                  cursor-pointer select-none
                `}
                aria-label={`Quick choice: ${sign.label}`}
              >
                {sign.imagePath ? (
                  <img
                    src={sign.imagePath}
                    alt={`${sign.label} Makaton symbol`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      e.currentTarget.parentElement
                        ?.querySelector<HTMLDivElement>("[data-placeholder]")
                        ?.removeAttribute("hidden");
                    }}
                  />
                ) : null}
                <div
                  data-placeholder
                  hidden={!!sign.imagePath}
                  className={sign.imagePath ? "hidden" : "w-3/4 h-3/4"}
                >
                  <MakatonPlaceholder label={sign.label} />
                </div>
              </button>
              {/* Star badge for first-session essentials */}
              {isFirstSession && (
                <div className="absolute -top-1 -right-1 bg-purple-500 rounded-full p-1 shadow-sm">
                  <Star className="w-3 h-3 text-white fill-white" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default QuickChoices;
