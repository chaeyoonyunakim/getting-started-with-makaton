import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "makaton-high-contrast";

export function useHighContrast() {
  const [highContrast, setHighContrast] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(highContrast));
    } catch { /* noop */ }
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  const toggle = useCallback(() => setHighContrast((v) => !v), []);

  return { highContrast, toggle };
}
