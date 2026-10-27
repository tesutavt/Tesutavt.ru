"use client";

import { useState } from "react";
import { Clock, MessageSquare, MessagesSquare, Pencil, Plus, Timer, Trash2, X } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Section } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

interface TimerItem {
  id: string;
  messages: string[];
  intervalSeconds: number;
  minMessages: number;
  enabled: boolean;
}

interface Draft {
  messages: string[];
  intervalMinutes: number;
  minMessages: number;
}

const INTERVAL_PRESETS = [5, 10, 15, 30, 60];
const EMPTY_DRAFT: Draft = { messages: [""], intervalMinutes: 15, minMessages: 5 };

async function errorText(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? fallback;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function scheduleText(t: { intervalSeconds: number; minMessages: number }) {
  const min = Math.round(t.intervalSeconds / 60);
  const base = `Каждые ${min} ${plural(min, "минуту", "минуты", "минут")}`;
  return t.minMessages > 0
    ? `${base}, если в чате написали хотя бы ${t.minMessages} ${plural(t.minMessages, "сообщение", "сообщения", "сообщений")}`
    : base;
}

export function TimersSection({ initialTimers }: { initialTimers: TimerItem[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [timers, setTimers] = useState(initialTimers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimerItem | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(timer: TimerItem) {
    setEditing(timer);
    setDraft({
      messages: timer.messages.length ? [...timer.messages] : [""],
      intervalMinutes: Math.max(1, Math.round(timer.intervalSeconds / 60)),
      minMessages: timer.minMessages,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function toggle(timer: TimerItem, enabled: boolean) {
    setTimers((prev) => prev.map((t) => (t.id === timer.id ? { ...t, enabled } : t)));
    const res = await fetch(`/api/bot/timers/${timer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) toast.success(enabled ? "Таймер включён" : "Таймер выключен");
    else {
      setTimers((prev) => prev.map((t) => (t.id === timer.id ? { ...t, enabled: !enabled } : t)));
      toast.error(await errorText(res, "Не получилось сохранить"));
    }
  }

  async function remove(timer: TimerItem) {
    const ok = await confirm({
      title: "Удалить таймер?",
      description: "Автосообщение перестанет отправляться в чат.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/bot/timers/${timer.id}`, { method: "DELETE" });
    if (res.ok) {
      setTimers((prev) => prev.filter((t) => t.id !== timer.id));
      toast.success("Таймер удалён");
    } else toast.error("Не получилось удалить таймер");
  }

  async function save() {
    const messages = draft.messages.map((m) => m.trim()).filter(Boolean);
    if (!messages.length) {
      setError("Напишите хотя бы один текст сообщения");
      return;
    }
    const body = {
      messages,
      intervalSeconds: Math.max(1, Math.round(draft.intervalMinutes)) * 60,
      minMessages: Math.max(0, Math.round(draft.minMessages) || 0),
    };
    setSaving(true);
    setError(null);
    const res = await fetch(editing ? `/api/bot/timers/${editing.id}` : "/api/bot/timers", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await errorText(res, "Не получилось сохранить"));
      return;
    }
    const timer = (await res.json()) as TimerItem;
    setTimers((prev) => (editing ? prev.map((t) => (t.id === timer.id ? timer : t)) : [...prev, timer]));
    toast.success(editing ? "Таймер сохранён" : "Таймер добавлен");
    setDialogOpen(false);
  }

  function setMessage(i: number, value: string) {
    setDraft((d) => ({ ...d, messages: d.messages.map((m, j) => (j === i ? value : m)) }));
  }

  return (
    <Section
      title="Таймеры"
      icon={Timer}
      description="Автосообщения в чат по расписанию — например, ссылки на соцсети или напоминание про !song."
      actions={
        <Button onClick={openCreate}>
          <Plus size={16} /> Новый таймер
        </Button>
      }
    >
      {timers.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Таймеров пока нет"
          description="Бот будет сам писать в чат раз в N минут — но только когда чат живой."
          action={
            <Button variant="secondary" onClick={openCreate}>
              <Plus size={16} /> Добавить таймер
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {timers.map((timer) => (
            <Card
              key={timer.id}
              className={`flex flex-col gap-3 p-4 transition-opacity ${timer.enabled ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <Clock size={16} className="shrink-0 text-accent" />
                  <span className="min-w-0">{scheduleText(timer)}</span>
                </div>
                <Switch checked={timer.enabled} onChange={(v) => toggle(timer, v)} />
              </div>
              <ul className="flex flex-col gap-1.5">
                {timer.messages.slice(0, 3).map((m, i) => (
                  <li key={i} className="truncate rounded-lg bg-subtle px-3 py-1.5 text-sm">
                    {m}
                  </li>
                ))}
                {timer.messages.length > 3 && (
                  <li className="px-1 text-xs text-muted">и ещё {timer.messages.length - 3}…</li>
                )}
              </ul>
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs text-muted">
                  <MessagesSquare size={12} />
                  {timer.messages.length > 1
                    ? `${timer.messages.length} ${plural(timer.messages.length, "вариант", "варианта", "вариантов")} — отправляется случайный`
                    : "1 вариант текста"}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(timer)} title="Изменить">
                    <Pencil size={16} />
                  </Button>
                  <Button variant="danger" size="icon" onClick={() => remove(timer)} title="Удалить">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        size="lg"
        icon={Timer}
        iconTone="accent"
        title={editing ? "Таймер" : "Новый таймер"}
        description="Если вариантов текста несколько — каждый раз бот выбирает случайный."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button loading={saving} onClick={save}>
              {editing ? "Сохранить" : "Добавить"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">Текст сообщения</span>
            {draft.messages.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={m}
                  onChange={(e) => setMessage(i, e.target.value)}
                  placeholder={i === 0 ? "Подписывайтесь на Telegram: t.me/…" : "Ещё один вариант"}
                  className="flex-1"
                />
                {draft.messages.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Убрать вариант"
                    onClick={() => setDraft((d) => ({ ...d, messages: d.messages.filter((_, j) => j !== i) }))}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => setDraft((d) => ({ ...d, messages: [...d.messages, ""] }))}
            >
              <Plus size={12} /> Добавить вариант
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">Как часто</span>
            <div className="flex flex-wrap items-center gap-2">
              {INTERVAL_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft((d) => ({ ...d, intervalMinutes: p }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    draft.intervalMinutes === p ? "bg-ink text-ink-foreground" : "bg-subtle hover:bg-border"
                  }`}
                >
                  {p} мин
                </button>
              ))}
              <div className="flex items-center gap-2 text-xs text-muted">
                или
                <Input
                  type="number"
                  min={1}
                  value={draft.intervalMinutes}
                  onChange={(e) => setDraft((d) => ({ ...d, intervalMinutes: Number(e.target.value) }))}
                  className="w-20"
                />
                мин
              </div>
            </div>
          </div>

          <Field
            label="Не отправлять в тихом чате"
            hint="Таймер сработает, только если с прошлой отправки в чате написали хотя бы столько сообщений. 0 — строго по времени."
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-muted" />
              <Input
                type="number"
                min={0}
                value={draft.minMessages}
                onChange={(e) => setDraft((d) => ({ ...d, minMessages: Number(e.target.value) }))}
                className="w-24"
              />
              <span className="text-sm text-muted">сообщений</span>
            </div>
          </Field>

          <p className="rounded-control bg-subtle px-3 py-2 text-sm">
            {scheduleText({ intervalSeconds: draft.intervalMinutes * 60, minMessages: draft.minMessages })}.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </Modal>
    </Section>
  );
}
