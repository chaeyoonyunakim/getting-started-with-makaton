import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "choice-board-reduce-motion";

function systemPrefers(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") return true;
      if (stored === "false") return false;
    } catch { /* noop */ }
    return systemPrefers();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(reduced));
    } catch { /* noop */ }
    document.documentElement.classList.toggle("reduce-motion", reduced);
  }, [reduced]);

  // Re-sync with OS changes when user hasn't explicitly chosen.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => {
      try {
        if (localStorage.getItem(STORAGE_KEY) === null) setReduced(mql.matches);
      } catch { /* noop */ }
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const toggle = useCallback(() => setReduced((v) => !v), []);
  return { reducedMotion: reduced, toggle, setReducedMotion: setReduced };
}
