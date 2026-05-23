import { ChevronRight, Home } from "lucide-react";
import { useRef } from "react";

interface SceneNavProps {
  breadcrumbs: string[];
  onBack: () => void;
  onHome: () => void;
}

/**
 * Breadcrumb-style scene navigator.
 * - Tap any crumb (or the Back chevron) to go up one level.
 * - Long-press (700ms) the Home button to reset to the root scene.
 * All targets are >= 64x64 px per SEND accessibility guidance.
 */
export const SceneNav = ({ breadcrumbs, onBack, onHome }: SceneNavProps) => {
  const pressTimer = useRef<number | null>(null);

  const startPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      onHome();
      pressTimer.current = null;
    }, 700);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const canGoBack = breadcrumbs.length > 1;

  return (
    <nav className="w-full flex items-center gap-2" aria-label="Scene navigation">
      <button
        type="button"
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onClick={() => canGoBack && onBack()}
        className="
          min-w-16 min-h-16 flex items-center justify-center
          bg-primary text-primary-foreground rounded-2xl shadow-md
          transition-transform hover:scale-105 active:scale-95
          focus:outline-none focus:ring-4 focus:ring-ring/50
        "
        aria-label={canGoBack ? "Back (long-press for home)" : "Home"}
      >
        <Home className="w-7 h-7" />
      </button>

      <ol className="flex items-center gap-1 flex-wrap text-base sm:text-lg font-semibold text-foreground">
        {breadcrumbs.map((label, i) => (
          <li key={`${label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
            <span className={i === breadcrumbs.length - 1 ? "text-primary" : "text-muted-foreground"}>
              {label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default SceneNav;
