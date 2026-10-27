"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Trash2, UserRound, Users } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Card";

interface ViewerDataRow {
  id: string;
  viewerLogin: string;
  viewerName: string;
  key: string;
  value: string;
  updatedAt: string;
}

interface Viewer {
  login: string;
  name: string;
  rows: ViewerDataRow[];
  updatedAt: string;
}

function initials(name: string) {
  return name.slice(0, 1).toUpperCase();
}

/** Цвет аватара-заглушки — стабильный по нику. */
function hueOf(login: string) {
  let h = 0;
  for (const ch of login) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU");
}

export function ViewerDataSection({ fieldLabels }: { fieldLabels: Record<string, string> }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ViewerDataRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/viewers/data?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!cancelled) {
        if (res.ok) setRows(await res.json());
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Группируем строки по зрителю: одна карточка — все его поля.
  const viewers = useMemo(() => {
    const map = new Map<string, Viewer>();
    for (const row of rows ?? []) {
      const v = map.get(row.viewerLogin) ?? { login: row.viewerLogin, name: row.viewerName, rows: [], updatedAt: row.updatedAt };
      v.rows.push(row);
      if (row.updatedAt > v.updatedAt) v.updatedAt = row.updatedAt;
      map.set(row.viewerLogin, v);
    }
    return [...map.values()];
  }, [rows]);

  const current = viewers.find((v) => v.login === selected) ?? null;

  async function deleteRow(row: ViewerDataRow) {
    setRows((list) => list?.filter((r) => r.id !== row.id) ?? null);
    const res = await fetch(`/api/viewers/data/${row.id}`, { method: "DELETE" });
    if (res.ok) toast.success(`«${fieldLabels[row.key] ?? row.key}» удалено`);
    else toast.error("Не получилось удалить значение");
  }

  async function deleteViewer(viewer: Viewer) {
    const ok = await confirm({
      title: `Удалить данные ${viewer.name}?`,
      description: "Все сохранённые значения этого зрителя будут удалены. Он сможет заполнить их заново через !set.",
      confirmLabel: "Удалить всё",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/viewers/data?login=${encodeURIComponent(viewer.login)}`, { method: "DELETE" });
    if (res.ok) {
      setRows((list) => list?.filter((r) => r.viewerLogin !== viewer.login) ?? null);
      setSelected(null);
      toast.success("Данные зрителя удалены");
    } else toast.error("Не получилось удалить данные");
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2.5 shadow-card transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <Search size={16} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти зрителя по нику"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        {loading && <Loader2 size={14} className="animate-spin text-muted" />}
      </label>

      {rows === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-surface shadow-card" />
          ))}
        </div>
      ) : viewers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "Никого не нашлось" : "Пока никто ничего не сохранил"}
          description={
            query ? "Попробуйте другую часть ника." : "Зрители заполняют данные сами — например, пишут в чат: !set city Москва"
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {viewers.map((v) => (
            <Card key={v.login} className="p-0">
              <button
                onClick={() => setSelected(v.login)}
                className="flex w-full flex-col gap-3 rounded-card p-4 text-left transition hover:bg-subtle/60"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ background: `hsl(${hueOf(v.login)} 55% 50%)` }}
                  >
                    {initials(v.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{v.name}</span>
                    <span className="block truncate text-xs text-muted">
                      @{v.login} · {relative(v.updatedAt)}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {v.rows.slice(0, 4).map((r) => (
                    <span key={r.id} className="max-w-full truncate rounded-full bg-subtle px-2.5 py-0.5 text-xs">
                      <span className="text-muted">{fieldLabels[r.key] ?? r.key}:</span> {r.value}
                    </span>
                  ))}
                  {v.rows.length > 4 && <span className="px-1 text-xs text-muted">+{v.rows.length - 4}</span>}
                </span>
              </button>
            </Card>
          ))}
        </div>
      )}
      {rows && rows.length >= 200 && (
        <p className="text-xs text-muted">Показаны последние 200 записей — уточните поиск, чтобы найти остальных.</p>
      )}

      <Modal
        open={Boolean(current)}
        onClose={() => setSelected(null)}
        icon={UserRound}
        iconTone="accent"
        title={current?.name}
        description={current ? `@${current.login}` : undefined}
        footer={
          current && (
            <>
              <Button variant="danger" onClick={() => deleteViewer(current)} className="mr-auto">
                <Trash2 size={16} /> Удалить всё
              </Button>
              <Button onClick={() => setSelected(null)}>Готово</Button>
            </>
          )
        }
      >
        {current && (
          <div className="flex flex-col divide-y divide-border">
            {current.rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="w-32 shrink-0 text-sm text-muted">{fieldLabels[r.key] ?? r.key}</span>
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{r.value}</span>
                <Button variant="danger" size="icon" title="Удалить значение" onClick={() => deleteRow(r)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
