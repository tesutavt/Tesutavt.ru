"use client";

import { useState } from "react";
import { Database, Users } from "lucide-react";

/** Вкладки «Зрители» / «Поля» — оба раздела смонтированы, чтобы не терять поиск при переключении. */
export function ViewersTabs({
  viewers,
  fields,
  viewerCount,
  fieldCount,
}: {
  viewers: React.ReactNode;
  fields: React.ReactNode;
  viewerCount: number;
  fieldCount: number;
}) {
  const [tab, setTab] = useState<"viewers" | "fields">("viewers");
  const tabs = [
    { key: "viewers" as const, label: "Зрители", icon: Users, count: viewerCount },
    { key: "fields" as const, label: "Поля", icon: Database, count: fieldCount },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-1 self-start rounded-full bg-surface p-1 shadow-card">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-ink text-ink-foreground" : "text-muted hover:text-surface-foreground"
            }`}
          >
            <t.icon size={16} />
            {t.label}
            <span
              className={`rounded-full px-1.5 text-xs tabular-nums ${tab === t.key ? "bg-white/20" : "bg-subtle"}`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>
      <div className={tab === "viewers" ? "anim-page-in" : "hidden"}>{viewers}</div>
      <div className={tab === "fields" ? "anim-page-in" : "hidden"}>{fields}</div>
    </div>
  );
}
