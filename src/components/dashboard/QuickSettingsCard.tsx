"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

interface QuickSettingsCardProps {
  initialTitle: string;
  initialGame: string;
}

export function QuickSettingsCard({ initialTitle, initialGame }: QuickSettingsCardProps) {
  const [title, setTitle] = useState(initialTitle);
  const [game, setGame] = useState(initialGame);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function update() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/channel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, game }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Обновлено" : (data.error ?? "Не получилось"));
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-5 shadow-card">
      <h3 className="text-sm font-semibold text-[var(--surface-foreground)]">Быстрые настройки</h3>

      <label className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
        Название стрима
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--subtle)] px-3 py-2 text-sm text-[var(--surface-foreground)] outline-none focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-[var(--muted-foreground)]">
        Категория трансляции
        <input
          value={game}
          onChange={(e) => setGame(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--subtle)] px-3 py-2 text-sm text-[var(--surface-foreground)] outline-none focus:border-accent"
        />
      </label>

      <button
        onClick={update}
        disabled={saving}
        className="flex items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--ink-foreground)] transition hover:opacity-90 disabled:opacity-50"
      >
        <RefreshCw size={14} /> Обновить
      </button>
      {message && <p className="text-xs text-[var(--muted-foreground)]">{message}</p>}
    </div>
  );
}
