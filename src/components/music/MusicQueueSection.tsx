"use client";

import { useEffect, useRef, useState } from "react";
import { ListMusic, Play, SkipForward, Trash2, Volume2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export interface MusicTrackView {
  id: string;
  source: "yandex" | "youtube";
  sourceId: string;
  title: string;
  artist: string;
  cover: string | null;
  durationMs: number;
  requestedBy: string;
  currentTimeSec: number;
}

interface MusicQueueSectionProps {
  initialCurrent: MusicTrackView | null;
  initialItems: MusicTrackView[];
  initialVolume: number;
  initialMaxQueueLength: number;
}

const POLL_MS = 5000;

export function MusicQueueSection({
  initialCurrent,
  initialItems,
  initialVolume,
  initialMaxQueueLength,
}: MusicQueueSectionProps) {
  const confirm = useConfirm();
  const [current, setCurrent] = useState(initialCurrent);
  const [items, setItems] = useState(initialItems);
  const [volume, setVolumeState] = useState(initialVolume);
  const [maxQueueLength, setMaxQueueLength] = useState(initialMaxQueueLength);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Живое обновление раз в 5с — своей WebSocket-инфраструктуры для музыки
  // нет (виджет на оверлее опрашивает публичный /state так же), поэтому
  // дашборд синхронизируется тем же способом.
  const volumeDirty = useRef(false);
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/music/queue", { cache: "no-store" });
        if (!res.ok) return;
        const state = await res.json();
        setCurrent(state.current);
        setItems(state.items);
        if (!volumeDirty.current) setVolumeState(state.volume);
        setMaxQueueLength(state.maxQueueLength);
      } catch {
        // сеть моргнула — подождём следующего тика
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  async function addTrack() {
    if (!query.trim()) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/music/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => [...prev, ...(data.tracks ?? [])]);
      setQuery("");
    } else {
      const data = await res.json().catch(() => ({}));
      setAddError(data.error || "Не получилось добавить трек");
    }
    setAdding(false);
  }

  async function removeTrack(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/music/queue/${id}`, { method: "DELETE" });
  }

  async function clearQueue() {
    const ok = await confirm({
      title: "Очистить очередь?",
      description: "Все запрошенные, но ещё не сыгравшие треки будут удалены. Текущий трек не остановится.",
      confirmLabel: "Очистить",
      danger: true,
    });
    if (!ok) return;
    setItems([]);
    await fetch("/api/music/clear", { method: "POST" });
  }

  async function skipTrack() {
    const res = await fetch("/api/music/skip", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCurrent(data.current);
      setItems((prev) => prev.filter((t) => t.id !== data.current?.id));
    }
  }

  async function changeVolume(next: number) {
    volumeDirty.current = true;
    setVolumeState(next);
    await fetch("/api/music/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volume: next }),
    });
    volumeDirty.current = false;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--subtle)]">
            {current?.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <Play size={18} className="text-[var(--muted-foreground)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--surface-foreground)]">
              {current ? current.title : "Сейчас ничего не играет"}
            </p>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              {current ? `${current.artist} · заказал ${current.requestedBy}` : "Добавьте трек ниже или через !song в чате"}
            </p>
          </div>
          <button
            onClick={skipTrack}
            disabled={!current}
            title="Пропустить"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition hover:bg-[var(--subtle)] hover:text-[var(--surface-foreground)] disabled:opacity-40"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Volume2 size={16} className="text-[var(--muted-foreground)]" />
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => changeVolume(Number(e.target.value) / 100)}
            className="w-full accent-[var(--ink)]"
          />
          <span className="w-10 shrink-0 text-right text-xs text-[var(--muted-foreground)]">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[var(--border)] p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTrack()}
          placeholder="Название трека, ссылка на Яндекс.Музыку или YouTube"
          className="min-w-[240px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--surface-foreground)] outline-none focus:border-accent"
        />
        <button
          onClick={addTrack}
          disabled={adding || !query.trim()}
          className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--ink-foreground)] transition hover:opacity-90 disabled:opacity-50"
        >
          {adding ? "Добавляем…" : "+ Добавить"}
        </button>
        {addError && <p className="w-full text-xs text-danger">{addError}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
            <ListMusic size={18} /> Очередь
            <span className="text-sm font-normal text-[var(--muted-foreground)]">
              {items.length}/{maxQueueLength}
            </span>
          </h2>
          {items.length > 0 && (
            <button
              onClick={clearQueue}
              className="text-xs font-medium text-[var(--muted-foreground)] transition hover:text-danger"
            >
              Очистить всё
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface)] p-4 text-sm text-[var(--muted-foreground)] shadow-card">
            Очередь пуста.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((track, i) => (
              <div
                key={track.id}
                className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] p-3 shadow-card"
              >
                <span className="w-5 shrink-0 text-center text-xs text-[var(--muted-foreground)]">{i + 1}</span>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--subtle)]">
                  {track.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Play size={14} className="text-[var(--muted-foreground)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--surface-foreground)]">{track.title}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                    {track.artist} · заказал {track.requestedBy}
                  </p>
                </div>
                <button
                  onClick={() => removeTrack(track.id)}
                  title="Удалить из очереди"
                  className="rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
