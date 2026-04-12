import { useEffect, useState } from "react";

const STORAGE_KEY = "bestie-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefers =
      stored === "dark" || (stored == null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(prefers);
    document.documentElement.classList.toggle("dark", prefers);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-elevated dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {dark ? "Claro" : "Oscuro"}
    </button>
  );
}
