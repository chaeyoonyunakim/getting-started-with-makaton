import { CORE_STRIP } from "@/lib/depthRouter";

interface CoreStripBarProps {
  onSelect: (key: string, label: string) => void;
  highContrast?: boolean;
}

/**
 * The 6 always-visible core words rendered at the bottom of every screen.
 * Tap targets are >= 64x64 px (iPad portrait optimised).
 */
export const CoreStripBar = ({ onSelect, highContrast }: CoreStripBarProps) => {
  return (
    <nav
      className="
        sticky bottom-0 inset-x-0 z-30
        bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80
        border-t-2 border-border
        px-2 py-3
      "
      aria-label="Core words"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-3 sm:grid-cols-6 gap-2">
        {CORE_STRIP.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => onSelect(w.key, w.label)}
            className={`
              min-h-16 rounded-2xl shadow-md
              text-base sm:text-lg font-bold
              transition-transform hover:scale-105 active:scale-95
              focus:outline-none focus:ring-4 focus:ring-ring/50
              ${highContrast ? "bg-foreground text-background border-2 border-black" : "bg-card text-card-foreground border-2 border-primary/40"}
            `}
            aria-label={w.label}
          >
            {w.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default CoreStripBar;
