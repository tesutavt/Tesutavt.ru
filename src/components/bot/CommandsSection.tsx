"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, MessageSquare, Pencil, Plus, Terminal, Timer, Trash2, Workflow } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, EmptyState, Section } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

interface CommandItem {
  id: string;
  trigger: string;
  standardKey: string | null;
  response: string | null;
  mode: string;
  userLevel: string;
  cooldownSeconds: number;
  enabled: boolean;
}

const USER_LEVELS: { value: string; label: string }[] = [
  { value: "everyone", label: "Все зрители" },
  { value: "subscriber", label: "Подписчики" },
  { value: "vip", label: "VIP" },
  { value: "moderator", label: "Модераторы" },
  { value: "broadcaster", label: "Только стример" },
];
const LEVEL_LABEL = Object.fromEntries(USER_LEVELS.map((l) => [l.value, l.label]));

/** Что делают встроенные команды — показывается вместо текста ответа. */
const STANDARD_INFO: Record<string, { description: string; usage?: string }> = {
  ping: { description: "Проверка бота: задержка базы и Twitch API, аптайм сервера и стрима." },
  title: { description: "Показывает название стрима. Модераторы могут сменить его.", usage: "!title Новое название" },
  game: { description: "Показывает категорию стрима. Модераторы могут сменить её.", usage: "!game Minecraft" },
  song: { description: "Заказ трека: ссылка YouTube или поиск по Яндекс.Музыке. Без аргумента — что играет сейчас.", usage: "!song Artist — Track" },
  skip: { description: "Пропустить текущий трек." },
  volume: { description: "Громкость плеера. Без числа — показывает текущую.", usage: "!volume 50" },
  vts: { description: "Запуск триггера VTube Studio. Без имени — список триггеров.", usage: "!vts wave" },
  viewerSet: { description: "Зритель сохраняет о себе значение (вкладка «Зрители»).", usage: "!set city Москва" },
  viewerGet: { description: "Показать сохранённые данные зрителя.", usage: "!get city" },
  viewerUnset: { description: "Удалить сохранённое значение.", usage: "!unset city" },
};

async function errorText(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? fallback;
}

interface Draft {
  trigger: string;
  response: string;
  userLevel: string;
  cooldownSeconds: number;
}

const EMPTY_DRAFT: Draft = { trigger: "", response: "", userLevel: "everyone", cooldownSeconds: 5 };

export function CommandsSection({ initialCommands }: { initialCommands: CommandItem[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [commands, setCommands] = useState(initialCommands);

  // Окно создания/редактирования: editing = null — новая команда.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommandItem | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const standard = commands.filter((c) => c.standardKey);
  const custom = commands.filter((c) => !c.standardKey);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(cmd: CommandItem) {
    setEditing(cmd);
    setDraft({
      trigger: cmd.trigger,
      response: cmd.response ?? "",
      userLevel: cmd.userLevel,
      cooldownSeconds: cmd.cooldownSeconds,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function patchCommand(id: string, patch: Partial<CommandItem>) {
    const res = await fetch(`/api/bot/commands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await errorText(res, "Не получилось сохранить"));
    const updated = (await res.json()) as CommandItem;
    setCommands((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    return updated;
  }

  async function toggleEnabled(cmd: CommandItem, enabled: boolean) {
    setCommands((prev) => prev.map((c) => (c.id === cmd.id ? { ...c, enabled } : c)));
    try {
      await patchCommand(cmd.id, { enabled });
      toast.success(enabled ? `${cmd.trigger} включена` : `${cmd.trigger} выключена`);
    } catch (e) {
      setCommands((prev) => prev.map((c) => (c.id === cmd.id ? { ...c, enabled: !enabled } : c)));
      toast.error((e as Error).message);
    }
  }

  async function toggleMode(cmd: CommandItem) {
    const mode = cmd.mode === "graph" ? "text" : "graph";
    if (mode === "text") {
      const ok = await confirm({
        title: "Вернуть текстовый ответ?",
        description: `Команда ${cmd.trigger} снова будет отвечать обычным текстом. Граф сохранится — к нему можно вернуться.`,
        confirmLabel: "Вернуть текст",
      });
      if (!ok) return;
    }
    try {
      await patchCommand(cmd.id, { mode });
      toast.success(mode === "graph" ? "Команда переведена на Blueprint-граф" : "Команда отвечает текстом");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteCommand(cmd: CommandItem) {
    const ok = await confirm({
      title: `Удалить ${cmd.trigger}?`,
      description: "Команда перестанет отвечать в чате. Это действие нельзя отменить.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/bot/commands/${cmd.id}`, { method: "DELETE" });
    if (res.ok) {
      setCommands((prev) => prev.filter((c) => c.id !== cmd.id));
      toast.success(`Команда ${cmd.trigger} удалена`);
    } else {
      toast.error(await errorText(res, "Не получилось удалить"));
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const patch: Partial<CommandItem> = {
          userLevel: draft.userLevel,
          cooldownSeconds: Math.max(0, Math.round(draft.cooldownSeconds) || 0),
        };
        if (!editing.standardKey && editing.mode !== "graph") patch.response = draft.response;
        await patchCommand(editing.id, patch);
        toast.success(`Команда ${editing.trigger} сохранена`);
      } else {
        if (!draft.trigger.trim()) {
          setError("Укажите название команды");
          return;
        }
        const res = await fetch("/api/bot/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trigger: draft.trigger,
            response: draft.response,
            userLevel: draft.userLevel,
            cooldownSeconds: Math.max(0, Math.round(draft.cooldownSeconds) || 0),
          }),
        });
        if (!res.ok) {
          setError(await errorText(res, "Не получилось добавить команду"));
          return;
        }
        const command = (await res.json()) as CommandItem;
        setCommands((prev) => [...prev, command]);
        toast.success(`Команда ${command.trigger} добавлена`);
      }
      setDialogOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const isStandard = Boolean(editing?.standardKey);
  const isGraph = editing?.mode === "graph";

  return (
    <Section
      title="Команды"
      icon={Terminal}
      description="Что бот отвечает на сообщения, начинающиеся с «!»."
      actions={
        <Button onClick={openCreate}>
          <Plus size={16} /> Новая команда
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">Свои команды</p>
        {custom.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Своих команд пока нет"
            description="Например, !discord со ссылкой на сервер или !socials со списком соцсетей."
            action={
              <Button variant="secondary" onClick={openCreate}>
                <Plus size={16} /> Добавить команду
              </Button>
            }
          />
        ) : (
          custom.map((cmd) => (
            <CommandRow
              key={cmd.id}
              cmd={cmd}
              onEdit={() => openEdit(cmd)}
              onToggle={(v) => toggleEnabled(cmd, v)}
              onToggleMode={() => toggleMode(cmd)}
              onDelete={() => deleteCommand(cmd)}
            />
          ))
        )}

        {standard.length > 0 && (
          <>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Встроенные команды</p>
            {standard.map((cmd) => (
              <CommandRow
                key={cmd.id}
                cmd={cmd}
                onEdit={() => openEdit(cmd)}
                onToggle={(v) => toggleEnabled(cmd, v)}
              />
            ))}
          </>
        )}
      </div>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={editing ? Pencil : Plus}
        iconTone="accent"
        title={editing ? `Команда ${editing.trigger}` : "Новая команда"}
        description={
          editing?.standardKey
            ? STANDARD_INFO[editing.standardKey]?.description
            : editing
              ? undefined
              : "Бот ответит этим текстом, когда кто-то напишет команду в чат."
        }
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
        <div className="flex flex-col gap-4">
          {!editing && (
            <Field label="Команда" hint="Восклицательный знак добавится сам.">
              <Input
                value={draft.trigger}
                onChange={(e) => setDraft({ ...draft, trigger: e.target.value })}
                placeholder="!discord"
                className="font-mono"
              />
            </Field>
          )}

          {!isStandard && !isGraph && (
            <Field
              label="Ответ бота"
              hint={
                <>
                  <code className="font-mono">{"{user}"}</code> — ник написавшего,{" "}
                  <code className="font-mono">{"{args}"}</code> — текст после команды,{" "}
                  <code className="font-mono">{"{viewer.city}"}</code> — данные зрителя.
                </>
              }
            >
              <Textarea
                rows={3}
                value={draft.response}
                onChange={(e) => setDraft({ ...draft, response: e.target.value })}
                placeholder="Наш Discord: https://discord.gg/…"
              />
            </Field>
          )}

          {isGraph && editing && (
            <Link href={`/dashboard/bot/commands/${editing.id}/blueprint`} className={buttonClass("secondary", "md", "self-start")}>
              <Workflow size={16} /> Открыть Blueprint-граф
            </Link>
          )}

          {isStandard && editing?.standardKey && STANDARD_INFO[editing.standardKey]?.usage && (
            <p className="text-sm text-muted">
              Пример: <code className="font-mono text-surface-foreground">{STANDARD_INFO[editing.standardKey].usage}</code>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Кто может использовать">
              <Select value={draft.userLevel} onChange={(e) => setDraft({ ...draft, userLevel: e.target.value })}>
                {USER_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Перезарядка, сек" hint="Пауза между ответами, чтобы не спамить.">
              <Input
                type="number"
                min={0}
                value={draft.cooldownSeconds}
                onChange={(e) => setDraft({ ...draft, cooldownSeconds: Number(e.target.value) })}
              />
            </Field>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </Modal>
    </Section>
  );
}

function CommandRow({
  cmd,
  onEdit,
  onToggle,
  onToggleMode,
  onDelete,
}: {
  cmd: CommandItem;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  onToggleMode?: () => void;
  onDelete?: () => void;
}) {
  const info = cmd.standardKey ? STANDARD_INFO[cmd.standardKey] : undefined;
  const summary = cmd.standardKey
    ? (info?.description ?? `встроенная команда: ${cmd.standardKey}`)
    : cmd.mode === "graph"
      ? "Отвечает по Blueprint-графу"
      : cmd.response || "Ответ не задан";

  return (
    <Card className={`flex items-center gap-3 p-3 transition-opacity ${cmd.enabled ? "" : "opacity-60"}`}>
      <button
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span className="shrink-0 rounded-lg bg-subtle px-2.5 py-1 font-mono text-sm font-medium">{cmd.trigger}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${cmd.response || cmd.standardKey ? "" : "italic text-muted"}`}>
            {cmd.mode === "graph" && !cmd.standardKey && <Workflow size={13} className="mr-1.5 inline text-accent" />}
            {summary}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Lock size={11} /> {LEVEL_LABEL[cmd.userLevel] ?? cmd.userLevel}
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer size={11} /> {cmd.cooldownSeconds} с
            </span>
          </span>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} title="Настроить">
          <Pencil size={16} />
        </Button>
        {onToggleMode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMode}
            title={cmd.mode === "graph" ? "Вернуть обычный текстовый ответ" : "Сделать Blueprint-графом"}
            className={cmd.mode === "graph" ? "!text-accent" : ""}
          >
            <Workflow size={16} />
          </Button>
        )}
        {onDelete && (
          <Button variant="danger" size="icon" onClick={onDelete} title="Удалить">
            <Trash2 size={16} />
          </Button>
        )}
        <div className="ml-1">
          <Switch checked={cmd.enabled} onChange={onToggle} />
        </div>
      </div>
    </Card>
  );
}
