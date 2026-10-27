"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const listeners = new Set<() => void>();

function setDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      onClick={() => setDark(!isDark)}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--surface-foreground)] shadow-card transition hover:opacity-80"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
