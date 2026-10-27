"use client";

import { useState } from "react";
import { Plus, Square } from "lucide-react";
import { WIDGET_PRESETS } from "@/lib/widget-presets";

interface LayerItem {
  id: string;
  name: string;
  kind: string;
}

interface LayersPanelProps {
  elements: LayerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (presetId?: string) => void;
}

export function LayersPanel({ elements, selectedId, onSelect, onAdd }: LayersPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="relative border-b border-[var(--border)] p-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-2 text-sm font-medium text-[var(--ink-foreground)] transition hover:opacity-90"
        >
          <Plus size={15} /> Добавить элемент
        </button>
        {menuOpen && (
          <div className="absolute left-3 right-3 top-full z-10 mt-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg shadow-black/10">
            <button
              onClick={() => {
                onAdd(undefined);
                setMenuOpen(false);
              }}
              className="block w-full rounded-xl px-2.5 py-2 text-left text-sm text-[var(--surface-foreground)] transition hover:bg-[var(--subtle)]"
            >
              Custom (пусто)
            </button>
            {WIDGET_PRESETS.filter((preset) => !preset.hidden).map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  onAdd(preset.id);
                  setMenuOpen(false);
                }}
                className="block w-full rounded-xl px-2.5 py-2 text-left text-sm text-[var(--surface-foreground)] transition hover:bg-[var(--subtle)]"
              >
                {preset.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {elements.length === 0 && (
          <p className="p-2 text-xs text-[var(--muted-foreground)]">
            Элементов пока нет — добавьте первый на холст.
          </p>
        )}
        {elements.map((element) => (
          <button
            key={element.id}
            onClick={() => onSelect(element.id)}
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
              selectedId === element.id
                ? "bg-[var(--ink)] text-[var(--ink-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface)]"
            }`}
          >
            <Square
              size={13}
              className={selectedId === element.id ? "text-[var(--ink-foreground)]" : "text-[var(--muted-foreground)]"}
            />
            <span className="min-w-0 flex-1 truncate">{element.name}</span>
            <span className="shrink-0 text-[10px] uppercase opacity-60">{element.kind}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
