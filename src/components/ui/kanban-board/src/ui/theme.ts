import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "ui-theme";

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies ?theme= or the saved theme before the first paint. Call once in main.tsx. */
export function applyInitialTheme() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("theme");
    const saved = fromUrl ?? localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  } catch {
    // Storage can be blocked; the system theme applies.
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => (typeof document === "undefined" ? "light" : current()));
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setThemeState(current());
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not saved; still applied for this visit.
    }
    setThemeState(next);
  }, []);
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
