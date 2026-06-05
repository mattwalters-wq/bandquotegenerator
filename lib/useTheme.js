"use client";
import { useEffect, useState } from "react";

// Light/dark theme, persisted in localStorage and applied as data-theme on <html>.
export function useTheme() {
  const [theme, setThemeState] = useState("dark");

  useEffect(() => {
    let saved = "dark";
    try { saved = localStorage.getItem("bqg_theme") || "dark"; } catch (e) {}
    setThemeState(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  const setTheme = (next) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("bqg_theme", next); } catch (e) {}
  };

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return { theme, setTheme, toggle };
}

// A stable per-browser session id, used to persist the Quick Quote / Pro view
// preference against the session in Supabase.
export function getSessionId() {
  try {
    let id = localStorage.getItem("bqg_session_id");
    if (!id) {
      id = (crypto?.randomUUID?.() || "s_" + Date.now() + "_" + Math.random().toString(36).slice(2));
      localStorage.setItem("bqg_session_id", id);
    }
    return id;
  } catch (e) {
    return null;
  }
}
