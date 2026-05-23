import { useRef, useState } from "react";
import { Check, CloudUpload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MakatonPlaceholder from "@/components/MakatonPlaceholder";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface BoardSymbol {
  id: string;
  label: string;
  imagePath?: string;
  colorClass: string;
}

export type BoardIntent = "category" | "subitem";

interface BoardCellProps {
  symbol: BoardSymbol;
  intent: BoardIntent;
  highContrast?: boolean;
  disabled?: boolean;
  predicted?: boolean;
  onSelect: (symbol: BoardSymbol) => void;
}

/**
 * One Makaton card. Renders image + hover-tooltip + (for AI-generated subitems)
 * a Save-to-Library badge. Handles tap animation and notification feedback.
 */
export const BoardCell = ({
  symbol,
  intent,
  highContrast,
  disabled,
  predicted,
  onSelect,
}: BoardCellProps) => {
  const [popping, setPopping] = useState(false);
  const [success, setSuccess] = useState(false);
  const sendingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | undefined>(symbol.imagePath);
  const resolveAttemptedRef = useRef(false);
  const isRemote = !!(symbol.imagePath && symbol.imagePath.startsWith("http"));
  const isSubItem = intent === "subitem";

  const handleClick = () => {
    if (sendingRef.current || disabled) return;
    if (!isSubItem) {
      setPopping(true);
      setTimeout(() => {
        setPopping(false);
        onSelect(symbol);
      }, 300);
      return;
    }
    sendingRef.current = true;
    setSuccess(true);
    onSelect(symbol);
    setTimeout(() => {
      sendingRef.current = false;
      setSuccess(false);
    }, 4000);
  };

  return (
    <div className="relative">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              disabled={disabled}
              className={`
                bg-card ${highContrast ? "border-[6px] border-black" : `border-4 ${symbol.colorClass.replace("bg-", "border-")}`}
                rounded-2xl shadow-md w-full aspect-square
                flex items-center justify-center p-0
                transition-all duration-150
                hover:scale-[1.03] active:scale-95
                focus:outline-none focus:ring-4 focus:ring-ring/50
                ${popping ? "animate-pop" : ""}
                ${success ? "ring-4 ring-green-400" : ""}
                ${predicted && !success ? "ring-2 ring-amber-400" : ""}
                cursor-pointer select-none relative overflow-hidden
              `}
              aria-label={symbol.label}
            >
              {symbol.imagePath ? (
                <img
                  src={imgSrc}
                  alt={`${symbol.label} sign`}
                  className={`absolute inset-0 w-full h-full object-contain ${imgError ? "hidden" : ""}`}
                  onError={async () => {
                    if (resolveAttemptedRef.current) {
                      setImgError(true);
                      return;
                    }
                    resolveAttemptedRef.current = true;
                    try {
                      const { data } = await supabase.functions.invoke("resolveSymbol", {
                        body: { label: symbol.label },
                      });
                      const url = (data as { resolved?: { url?: string } } | null)?.resolved?.url;
                      if (url) {
                        setImgSrc(url);
                      } else {
                        setImgError(true);
                      }
                    } catch {
                      setImgError(true);
                    }
                  }}
                />
              ) : null}
              <div
                data-placeholder
                hidden={!!symbol.imagePath || imgError ? true : undefined}
                className={!!symbol.imagePath || imgError ? "hidden" : "w-3/4 h-3/4"}
              >
                <MakatonPlaceholder label={symbol.label} />
              </div>
              {imgError && (
                <span className="text-foreground text-lg font-semibold text-center px-2">
                  {symbol.label}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-lg font-semibold px-4 py-2">
            {symbol.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isSubItem && isRemote && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (saving || saved) return;
            setSaving(true);
            try {
              const { error } = await supabase.functions.invoke("makaton-save-symbol", {
                body: { image_url: symbol.imagePath, sign_name: symbol.label },
              });
              if (error) throw error;
              setSaved(true);
              toast.success("Saved to library!", { description: `${symbol.label} symbol committed.` });
            } catch {
              toast.error("Save failed", { description: "Could not commit the symbol." });
            } finally {
              setSaving(false);
            }
          }}
          className={`
            absolute top-2 left-2 z-10 rounded-full p-1.5 shadow-md
            transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring/50
            ${saved ? "bg-green-500 text-white cursor-default" : "bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground backdrop-blur-sm"}
          `}
          aria-label={saved ? "Saved to library" : "Save to library"}
          disabled={saving || saved}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <CloudUpload className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
};

export default BoardCell;
