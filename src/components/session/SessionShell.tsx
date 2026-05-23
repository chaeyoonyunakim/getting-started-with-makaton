import { useEffect, type ReactNode } from "react";
import { Sparkles, Coffee, X } from "lucide-react";
import { useSession } from "@/hooks/useSession";

interface SessionShellProps {
  pupilId: string | null;
  depth: number;
  children: (api: {
    recordTap: (sceneId: string) => Promise<void>;
    endSession: () => Promise<void>;
  }) => ReactNode;
}

/**
 * Wraps the board UI with session lifecycle:
 * - Quiet TA-only countdown / soft-cap banner after 10 minutes.
 * - End button (TA control).
 * - Auto-ends after 3 min inactivity (hooked into useSession).
 * - Shows a Golden Sign celebration when criteria are met on end.
 */
export const SessionShell = ({ pupilId, depth, children }: SessionShellProps) => {
  const { state, softCap, rewardJustAwarded, recordTap, endSession, acknowledgeReward } = useSession({
    pupilId,
    depth,
  });

  // Listen for the Home long-press signal dispatched by SceneNav.
  useEffect(() => {
    const handler = () => endSession();
    window.addEventListener("session:end", handler);
    return () => window.removeEventListener("session:end", handler);
  }, [endSession]);

  return (
    <div className="relative">
      {softCap && !state.endedAt && (
        <div
          role="status"
          aria-label="TA: session running long"
          className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <Coffee className="w-4 h-4 mt-0.5" />
          <p className="flex-1">
            <strong>TA note:</strong> session has been running for 10+ minutes. Consider a short break.
          </p>
          <button onClick={endSession} className="font-semibold underline" aria-label="End session now">
            End now
          </button>
        </div>
      )}

      {state.id && !state.endedAt && (
        <button
          onClick={endSession}
          className="absolute right-0 top-0 text-xs text-muted-foreground hover:text-foreground"
          aria-label="End session"
        >
          End session
        </button>
      )}

      {children({ recordTap, endSession })}

      {rewardJustAwarded && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur"
        >
          <div className="bg-card border-4 border-amber-400 rounded-3xl shadow-2xl p-8 max-w-sm text-center animate-victory-bounce">
            <Sparkles className="w-16 h-16 mx-auto text-amber-500" aria-hidden />
            <h2 className="text-2xl font-extrabold mt-3">Golden Sign!</h2>
            <p className="text-muted-foreground mt-2">
              Great session — {state.totalSelections} choices across {state.scenes.size} scenes.
            </p>
            <button
              onClick={acknowledgeReward}
              className="mt-5 inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 font-bold"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionShell;
