"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "privcode_theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const initialTheme = savedTheme === "light" ? "light" : "dark";
    applyTheme(initialTheme);
    setTheme(initialTheme);
  }, []);

  const applyTheme = (nextTheme) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(nextTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
  };

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className="fixed top-3 right-3 z-[9999] inline-flex items-center gap-2 rounded-md border border-pc-border bg-pc-surface px-3 py-1.5 text-xs font-medium text-pc-text shadow-sm hover:bg-pc-hover transition"
    >
      {isLight ? <Moon size={14} /> : <Sun size={14} />}
      <span>{isLight ? "Dark" : "Light"}</span>
    </button>
  );
}
