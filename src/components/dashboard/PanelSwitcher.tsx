"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Users } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export interface PanelOption {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
}

function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    <Image src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full" />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Кнопка с аватаром в шапке: своя панель + панели, где пользователь редактор. */
export function PanelSwitcher({
  me,
  current,
  shared,
}: {
  me: PanelOption;
  current: PanelOption;
  shared: PanelOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const delegated = current.id !== me.id;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function switchTo(panel: PanelOption) {
    if (panel.id === current.id) {
      setOpen(false);
      return;
    }
    setSwitching(panel.id);
    const res = await fetch("/api/panel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: panel.id === me.id ? null : panel.id }),
    });
    setSwitching(null);
    setOpen(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Не получилось переключить панель");
      return;
    }
    toast.success(panel.id === me.id ? "Вы в своей панели" : `Открыта панель ${panel.displayName}`);
    router.push("/dashboard");
    router.refresh();
  }

  // Без чужих панелей переключать нечего — просто показываем аккаунт.
  if (!shared.length) {
    return (
      <div className="flex items-center gap-3 rounded-full bg-surface py-1.5 pl-2 pr-4 shadow-card">
        <Avatar src={me.avatarUrl} name={me.displayName} />
        <span className="text-sm font-medium text-surface-foreground">{me.displayName}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-3 rounded-full py-1.5 pl-2 pr-3 shadow-card transition ${
          delegated ? "bg-warning-soft ring-2 ring-warning/50" : "bg-surface hover:bg-subtle"
        }`}
      >
        <Avatar src={current.avatarUrl} name={current.displayName} />
        <span className="text-left">
          <span className="block text-sm font-medium leading-tight text-surface-foreground">
            {current.displayName}
          </span>
          {delegated && <span className="block text-[11px] leading-tight text-muted">вы — {me.displayName}</span>}
        </span>
        <ChevronDown size={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="anim-dialog-in absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-card border border-border bg-surface p-1.5 text-surface-foreground shadow-dialog">
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">Моя панель</p>
          <PanelItem panel={me} active={current.id === me.id} busy={switching === me.id} onClick={() => switchTo(me)} />
          <p className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-xs font-medium text-muted">
            <Users size={12} /> Мне выдали доступ
          </p>
          {shared.map((p) => (
            <PanelItem
              key={p.id}
              panel={p}
              active={current.id === p.id}
              busy={switching === p.id}
              onClick={() => switchTo(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PanelItem({
  panel,
  active,
  busy,
  onClick,
}: {
  panel: PanelOption;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-control px-3 py-2 text-left transition ${
        active ? "bg-subtle" : "hover:bg-subtle"
      }`}
    >
      <Avatar src={panel.avatarUrl} name={panel.displayName} size={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{panel.displayName}</span>
        <span className="block truncate text-xs text-muted">@{panel.login}</span>
      </span>
      {busy ? (
        <Loader2 size={16} className="animate-spin text-muted" />
      ) : (
        active && <Check size={16} className="text-success" />
      )}
    </button>
  );
}
