import { useState, useCallback, useRef, useMemo } from "react";
import { ArrowLeft, Loader2, X, Sparkles, Info, RotateCcw, Eye, Check } from "lucide-react";
import { categories } from "@/data/makaton";
import { Category, ChoiceItem, makatonAssetUrl } from "@/types/choiceBoard";
import { supabase } from "@/integrations/supabase/client";
import { useStudent } from "@/contexts/StudentContext";
import { toast } from "sonner";
import { useHighContrast } from "@/hooks/useHighContrast";
import { usePupilBoard } from "@/hooks/usePupilBoard";
import BoardGrid from "@/components/board/BoardGrid";
import BoardCell, { type BoardSymbol } from "@/components/board/BoardCell";
import CoreStrip from "@/components/board/CoreStrip";
import { useNextCardPredictions } from "@/hooks/useNextCardPredictions";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TANotifiedBadge = () => (
  <div className="flex items-center gap-1.5 bg-accent/20 text-accent-foreground rounded-full px-3 py-1 text-sm font-medium animate-fade-in">
    <Check className="w-4 h-4 text-primary" />
    <span>TA Notified</span>
  </div>
);

const SpeechBubble = ({ text, loading, onDismiss }: { text: string; loading: boolean; onDismiss: () => void }) => {
  if (!loading && !text) return null;
  return (
    <div className="relative w-full animate-fade-in">
      <div className="bg-card text-card-foreground rounded-2xl shadow-lg px-6 py-4 relative border border-border">
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-muted-foreground text-lg">Thinking…</span>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <p className="text-lg sm:text-xl font-medium flex-1">{text}</p>
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1" aria-label="Dismiss greeting">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="absolute -bottom-3 left-8 w-6 h-6 bg-card border-b border-r border-border rotate-45 transform" />
      </div>
    </div>
  );
};

const itemToSymbol = (item: ChoiceItem): BoardSymbol => ({
  id: item.id,
  label: item.label,
  imagePath: item.imagePath,
  colorClass: item.colorClass,
});

const ChoiceBoard = () => {
  const { currentStudent, currentPupilId } = useStudent();
  const { highContrast, toggle: toggleContrast } = useHighContrast();
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [greeting, setGreeting] = useState("");
  const [greetingLoading, setGreetingLoading] = useState(false);
  const [selectionCount, setSelectionCount] = useState(0);
  const selectionsRef = useRef<string[]>([]);
  const [rewardImage, setRewardImage] = useState<string | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const boardLockedRef = useRef(false);
  const [boardLocked, setBoardLocked] = useState(false);
  const [lastRationale, setLastRationale] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [notifiedItemId, setNotifiedItemId] = useState<string | null>(null);

  // Root-level grid sourced from the DB via the typed hook (with local fallback).
  const { data: rootBoard } = usePupilBoard(currentPupilId, "root");
  const { data: childBoard } = usePupilBoard(currentPupilId, activeCategory?.id ?? null);

  // Next-card personalisation: highlights the most likely follow-on cards.
  // No-ops when the active category isn't a real DB scene UUID.
  const { topIds: predictedIds } = useNextCardPredictions(
    currentPupilId,
    activeCategory?.id ?? null,
    null,
  );

  const handleFullReset = useCallback(() => {
    setActiveCategory(null);
    setGreeting("");
    setGreetingLoading(false);
    setSelectionCount(0);
    selectionsRef.current = [];
    setRewardImage(null);
    setRewardOpen(false);
    setLastRationale(null);
    setResetConfirmOpen(false);
  }, []);

  const fetchGreeting = useCallback(async (category: Category) => {
    setGreetingLoading(true);
    setGreeting("");
    try {
      const { data, error } = await supabase.functions.invoke("makaton-greeting", { body: { category: category.label } });
      if (error) throw error;
      const text = typeof data === "string" ? data : data?.greeting || data?.message || data?.text || data?.result || JSON.stringify(data);
      setGreeting(text);
      if (data?.rationale || data?.reason) setLastRationale(data.rationale || data.reason);
    } catch {
      setGreeting("Great choice! Let's explore together! 🌟");
    } finally {
      setGreetingLoading(false);
    }
  }, []);

  const handleCategorySelect = useCallback(
    (category: Category) => {
      setActiveCategory(category);
      fetchGreeting(category);
    },
    [fetchGreeting]
  );

  const handleBack = useCallback(() => {
    setActiveCategory(null);
    setGreeting("");
    setGreetingLoading(false);
    setLastRationale(null);
  }, []);

  const handleSubItemSelect = useCallback(
    async (item: ChoiceItem) => {
      if (boardLockedRef.current) return;
      boardLockedRef.current = true;
      setBoardLocked(true);
      setNotifiedItemId(item.id);
      const timeout = setTimeout(() => {
        boardLockedRef.current = false;
        setBoardLocked(false);
      }, 2000);

      const newSelections = [...selectionsRef.current, item.label];
      selectionsRef.current = newSelections;
      const newCount = selectionCount + 1;
      setSelectionCount(newCount);

      // Fire-and-forget notify (the cell already shows optimistic success).
      supabase.functions
        .invoke("makaton-notifier", { body: { child_name: currentStudent, selection: item.label } })
        .then(({ error }) => {
          if (error) {
            const errMsg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
            if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit")) {
              toast.error("Slow down! 🐢", { description: "Too many requests — please wait a moment.", duration: 5000 });
            } else {
              toast.error("Notification may not have sent", { description: "The TA might not have been notified." });
            }
          }
        })
        .catch(() => toast.error("Notification may not have sent"));

      if (newCount % 3 === 0) {
        setRewardOpen(true);
        setRewardImage(null);
        try {
          const { data, error } = await supabase.functions.invoke("makaton-reward", {
            body: { makatonId: item.makatonId, assetUrl: makatonAssetUrl(item.makatonId), label: item.label, color: "Electric Blue" },
          });
          if (error) throw error;
          const imgUrl = data?.image || null;
          setRewardImage(imgUrl);
          if (imgUrl) {
            try {
              const ctx = new AudioContext();
              const playNote = (freq: number, start: number, dur: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "triangle";
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
                osc.connect(gain).connect(ctx.destination);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + dur);
              };
              playNote(523, 0, 0.2);
              playNote(659, 0.15, 0.2);
              playNote(784, 0.3, 0.4);
            } catch {}
          }
        } catch {
          toast.error("Reward couldn't load", { description: "But great job picking 3 things! ⭐" });
          setRewardOpen(false);
        }
      }

      clearTimeout(timeout);
      boardLockedRef.current = false;
      setBoardLocked(false);
      setTimeout(() => setNotifiedItemId(null), 4000);
    },
    [selectionCount, currentStudent]
  );

  // Resolve items shown on the current scene.
  const items = useMemo(() => {
    if (activeCategory) {
      if (childBoard?.gridItems?.length) return childBoard.gridItems;
      return activeCategory.items.map(itemToSymbol);
    }
    if (rootBoard?.gridItems?.length) return rootBoard.gridItems;
    return categories.map((c) => itemToSymbol(c));
  }, [activeCategory, childBoard, rootBoard]);

  const cols = 2;
  const rows = Math.ceil(items.length / cols);

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto px-4 py-6 gap-6">
      <div className="w-full flex justify-end gap-3">
        <button
          onClick={toggleContrast}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-lg font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50 ${highContrast ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground"}`}
          aria-label="Toggle high contrast mode"
          aria-pressed={highContrast}
        >
          <Eye className="w-6 h-6" />
          <span className="hidden sm:inline">High Contrast</span>
        </button>
        <button
          onClick={() => setResetConfirmOpen(true)}
          className="flex items-center gap-2 bg-destructive text-destructive-foreground rounded-xl px-4 py-3 text-lg font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50"
          aria-label="Start again"
        >
          <RotateCcw className="w-6 h-6" />
          <span className="hidden sm:inline">Start Again</span>
        </button>
      </div>

      <CoreStrip
        category={activeCategory?.label}
        highContrast={highContrast}
        historyLog={selectionsRef.current}
        onSelect={(label) => {
          const matched = categories.find((c) => c.label.toLowerCase() === label.toLowerCase());
          if (matched && !activeCategory) handleCategorySelect(matched);
          else handleSubItemSelect({ id: `quick-${label}`, label, makatonId: 0, colorClass: "" });
        }}
      />

      {activeCategory && (
        <button
          onClick={handleBack}
          className="self-start flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-3 text-lg sm:text-xl font-bold shadow-md transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50 animate-fade-in"
          aria-label="Back to categories"
        >
          <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          Back
        </button>
      )}

      {activeCategory && (greetingLoading || greeting) && (
        <SpeechBubble text={greeting} loading={greetingLoading} onDismiss={() => setGreeting("")} />
      )}

      {activeCategory && childBoard === undefined && (
        <BoardGrid rows={2} cols={2}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`bg-card ${highContrast ? "border-[6px] border-black" : "border-4 border-muted"} rounded-2xl shadow-md w-full aspect-square animate-pulse`} />
          ))}
        </BoardGrid>
      )}

      {!(activeCategory && childBoard === undefined) && (
        <BoardGrid rows={rows} cols={cols}>
          {items.map((sym) => (
            <div key={sym.id} className="relative">
              <BoardCell
                symbol={sym}
                intent={activeCategory ? "subitem" : "category"}
                highContrast={highContrast}
                disabled={!!activeCategory && boardLocked}
                predicted={!!activeCategory && predictedIds.has(sym.id)}
                onSelect={() => {
                  if (!activeCategory) {
                    const fullCat = categories.find((c) => c.id === sym.id || c.label === sym.label);
                    if (fullCat) handleCategorySelect(fullCat);
                  } else {
                    const source = activeCategory.items.find((i) => i.id === sym.id);
                    if (source) handleSubItemSelect(source);
                  }
                }}
              />
              {notifiedItemId === sym.id && activeCategory && (
                <div className="absolute -top-2 -right-2 flex items-center gap-1 z-10">
                  <TANotifiedBadge />
                  {lastRationale && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="bg-muted rounded-full p-1 shadow-sm hover:bg-muted/80 transition-colors" aria-label="Why was the TA notified?">
                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-sm">{lastRationale}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}
            </div>
          ))}
        </BoardGrid>
      )}

      {rewardOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[hsl(45,100%,85%)] animate-fade-in">
          {!rewardImage ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
              <p className="text-xl font-bold text-foreground">Almost there…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6 animate-fade-in">
                <Sparkles className="w-10 h-10 text-accent" />
                <h2 className="text-4xl sm:text-5xl font-extrabold text-foreground">Amazing Job!</h2>
                <Sparkles className="w-10 h-10 text-accent" />
              </div>
              <p className="text-xl text-muted-foreground mb-8">You picked 3 things! Here's your Golden Sign!</p>
              <img src={rewardImage} alt="Your Golden Sign" className="w-64 h-64 sm:w-80 sm:h-80 object-contain rounded-3xl shadow-2xl border-4 border-accent animate-victory-bounce" />
              <button
                onClick={() => {
                  setRewardOpen(false);
                  setRewardImage(null);
                  setSelectionCount(0);
                  selectionsRef.current = [];
                }}
                className="mt-10 bg-primary text-primary-foreground rounded-2xl px-10 py-5 text-2xl font-extrabold shadow-xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50 animate-fade-in"
              >
                ⬅ Back to Board
              </button>
            </>
          )}
        </div>
      )}

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent className="sm:max-w-sm flex flex-col items-center gap-6 py-8">
          <DialogTitle className="text-2xl sm:text-3xl font-bold text-center">Start Again?</DialogTitle>
          <DialogDescription className="text-center text-lg text-muted-foreground">
            This will reset everything back to the beginning.
          </DialogDescription>
          <div className="flex gap-4 w-full">
            <button onClick={() => setResetConfirmOpen(false)} className="flex-1 bg-secondary text-secondary-foreground rounded-xl px-6 py-4 text-xl font-bold shadow-md transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50">No</button>
            <button onClick={handleFullReset} className="flex-1 bg-destructive text-destructive-foreground rounded-xl px-6 py-4 text-xl font-bold shadow-md transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-ring/50">Yes</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChoiceBoard;
