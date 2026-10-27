"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, ShieldCheck, Unlink } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export interface BotStatus {
  connected: boolean;
  botLogin?: string;
  botDisplayName?: string;
  enabled?: boolean;
  running?: boolean;
}

export function BotStatusCard({
  status,
  ownerActions = true,
}: {
  status: BotStatus;
  /** false — чужая панель: привязать/отвязать бот-аккаунт может только владелец. */
  ownerActions?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [modResult, setModResult] = useState<string | null>(null);

  async function toggle(enabled: boolean) {
    setBusy(true);
    await fetch("/api/bot", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    router.refresh();
    setBusy(false);
  }

  async function disconnect() {
    const ok = await confirm({
      title: "Отключить бота?",
      description: "Команды и таймеры сохранятся, но бот перестанет отвечать в чате.",
      confirmLabel: "Отключить",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    await fetch("/api/bot", { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  async function makeMod() {
    setBusy(true);
    setModResult(null);
    const res = await fetch("/api/bot/mod", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setModResult(res.ok ? "Бот назначен модератором канала" : (data.error ?? "Не получилось"));
    setBusy(false);
  }

  if (!status.connected) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--surface)] p-8 text-center shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--subtle)]">
          <Bot size={22} className="text-[var(--muted-foreground)]" />
        </div>
        {ownerActions ? (
          <>
            <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
              Бот пока не подключён. Понадобится отдельный Twitch-аккаунт для бота (не
              основной канал стримера) — откроется отдельный вход через Twitch.
            </p>
            <a
              href="/api/bot/connect"
              className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--ink-foreground)] transition hover:opacity-90"
            >
              Подключить бот-аккаунт
            </a>
          </>
        ) : (
          <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
            Бот на этом канале ещё не подключён. Подключить бот-аккаунт может только владелец канала.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[var(--surface)] p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="font-medium text-[var(--surface-foreground)]">{status.botDisplayName}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              @{status.botLogin} ·{" "}
              <span className={status.running ? "text-success" : "text-[var(--muted-foreground)]"}>
                {status.running ? "подключен к чату" : "не подключен"}
              </span>
            </p>
          </div>
        </div>
        <Switch checked={!!status.enabled} disabled={busy} onChange={toggle} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={makeMod}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-[var(--subtle)] px-4 py-2 text-sm font-medium text-[var(--surface-foreground)] transition hover:opacity-80 disabled:opacity-50"
        >
          <ShieldCheck size={15} /> Сделать модератором
        </button>
        {ownerActions && (
          <button
            onClick={disconnect}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft disabled:opacity-50"
          >
            <Unlink size={15} /> Отключить бота
          </button>
        )}
      </div>
      {modResult && <p className="text-xs text-[var(--muted-foreground)]">{modResult}</p>}
    </div>
  );
}
