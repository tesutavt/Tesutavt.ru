"use client";

import { useState } from "react";
import { CalendarDays, Hash, Pencil, Plus, Trash2, Type, X } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

type FieldType = "text" | "number" | "date";

interface ViewerFieldView {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  aliases: string[];
  maxLength: number;
  enabled: boolean;
}

const TYPES: { value: FieldType; label: string; icon: typeof Type; example: string }[] = [
  { value: "text", label: "Текст", icon: Type, example: "Москва" },
  { value: "number", label: "Число", icon: Hash, example: "42" },
  { value: "date", label: "Дата", icon: CalendarDays, example: "15.02.2003" },
];

const PRESETS: { key: string; label: string; type: FieldType; aliases: string[] }[] = [
  { key: "pet", label: "Питомец", type: "text", aliases: ["питомец"] },
  { key: "color", label: "Любимый цвет", type: "text", aliases: ["цвет"] },
  { key: "age", label: "Возраст", type: "number", aliases: ["возраст"] },
  { key: "anime", label: "Любимое аниме", type: "text", aliases: ["аниме"] },
  { key: "zodiac", label: "Знак зодиака", type: "text", aliases: ["знак"] },
];

interface Draft {
  key: string;
  label: string;
  type: FieldType;
  aliases: string[];
  maxLength: number;
}

const EMPTY: Draft = { key: "", label: "", type: "text", aliases: [], maxLength: 100 };

export function ViewerFieldsSection({ initialFields }: { initialFields: ViewerFieldView[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [fields, setFields] = useState(initialFields);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ViewerFieldView | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [aliasInput, setAliasInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate(preset?: Draft) {
    setEditing(null);
    setDraft(preset ?? EMPTY);
    setAliasInput("");
    setError(null);
    setOpen(true);
  }

  function openEdit(f: ViewerFieldView) {
    setEditing(f);
    setDraft({ key: f.key, label: f.label, type: f.type, aliases: [...f.aliases], maxLength: f.maxLength });
    setAliasInput("");
    setError(null);
    setOpen(true);
  }

  function addAlias() {
    const a = aliasInput.trim().toLowerCase();
    if (a && !draft.aliases.includes(a)) setDraft((d) => ({ ...d, aliases: [...d.aliases, a] }));
    setAliasInput("");
  }

  async function toggle(f: ViewerFieldView, enabled: boolean) {
    setFields((list) => list.map((x) => (x.id === f.id ? { ...x, enabled } : x)));
    const res = await fetch(`/api/viewers/fields/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) toast.success(enabled ? `«${f.label}» можно заполнять` : `«${f.label}» выключено`);
    else {
      setFields((list) => list.map((x) => (x.id === f.id ? { ...x, enabled: !enabled } : x)));
      toast.error("Не получилось сохранить");
    }
  }

  async function save() {
    const aliases = aliasInput.trim() ? [...draft.aliases, aliasInput.trim().toLowerCase()] : draft.aliases;
    setSaving(true);
    setError(null);
    const res = await fetch(editing ? `/api/viewers/fields/${editing.id}` : "/api/viewers/fields", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, aliases }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Не получилось сохранить");
      return;
    }
    setFields((list) => (editing ? list.map((f) => (f.id === data.id ? data : f)) : [...list, data]));
    toast.success(editing ? "Поле сохранено" : `Поле «${data.label}» добавлено`, `В чате: !set ${data.key} …`);
    setOpen(false);
  }

  async function remove(f: ViewerFieldView) {
    const ok = await confirm({
      title: `Удалить поле «${f.label}»?`,
      description: "Все сохранённые значения этого поля у зрителей тоже удалятся.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/viewers/fields/${f.id}`, { method: "DELETE" });
    if (res.ok) {
      setFields((list) => list.filter((x) => x.id !== f.id));
      toast.success("Поле удалено");
    } else toast.error("Не получилось удалить поле");
  }

  const unusedPresets = PRESETS.filter((p) => !fields.some((f) => f.key === p.key));
  const typeMeta = TYPES.find((t) => t.value === draft.type)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => {
          const t = TYPES.find((x) => x.value === f.type)!;
          return (
            <Card key={f.id} className={`flex flex-col gap-3 p-4 transition-opacity ${f.enabled ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                  <t.icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.label}</span>
                  <span className="block font-mono text-xs text-muted">{`{viewer.${f.key}}`}</span>
                </span>
                <Switch checked={f.enabled} onChange={(v) => toggle(f, v)} />
              </div>
              <p className="rounded-control bg-subtle px-3 py-1.5 font-mono text-xs">
                !set {f.key} {t.example}
              </p>
              <div className="mt-auto flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  {f.aliases.length ? `или: ${f.aliases.join(", ")}` : t.label}
                </span>
                <Button variant="ghost" size="icon" onClick={() => openEdit(f)} title="Изменить">
                  <Pencil size={16} />
                </Button>
                <Button variant="danger" size="icon" onClick={() => remove(f)} title="Удалить">
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          );
        })}

        <button
          onClick={() => openCreate()}
          className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border text-muted transition hover:border-accent hover:text-accent"
        >
          <Plus size={22} />
          <span className="text-sm font-medium">Новое поле</span>
        </button>
      </div>

      {unusedPresets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Идеи:</span>
          {unusedPresets.map((p) => (
            <button
              key={p.key}
              onClick={() => openCreate({ ...p, maxLength: 100 })}
              className="rounded-full border border-border px-3 py-1 text-xs transition hover:border-accent hover:text-accent"
            >
              + {p.label}
            </button>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon={editing ? Pencil : Plus}
        iconTone="accent"
        title={editing ? `Поле «${editing.label}»` : "Новое поле"}
        description="Зрители заполняют его сами командой !set в чате."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button loading={saving} onClick={save}>
              {editing ? "Сохранить" : "Добавить"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Название">
            <Input
              value={draft.label}
              maxLength={40}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="Питомец"
            />
          </Field>
          {!editing && (
            <Field label="Ключ" hint="Латиница — для !set и {viewer.ключ} в ответах бота.">
              <Input
                value={draft.key}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))
                }
                placeholder="pet"
                className="font-mono"
              />
            </Field>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Тип</span>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setDraft((d) => ({ ...d, type: t.value }))}
                  className={`flex flex-col items-center gap-1 rounded-control border-2 px-2 py-2.5 text-xs transition ${
                    draft.type === t.value ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-muted"
                  }`}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Другие имена для !set" hint="Например, по-русски: !set питомец Барсик. Enter — добавить.">
            <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1.5 focus-within:border-accent">
              {draft.aliases.map((a) => (
                <span key={a} className="flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs">
                  {a}
                  <button
                    onClick={() => setDraft((d) => ({ ...d, aliases: d.aliases.filter((x) => x !== a) }))}
                    aria-label={`Убрать ${a}`}
                    className="text-muted hover:text-danger"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value.replace(/[\s,]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addAlias();
                  }
                }}
                onBlur={addAlias}
                placeholder={draft.aliases.length ? "" : "питомец"}
                className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted"
              />
            </div>
          </Field>
          {draft.type === "text" && (
            <Field label="Максимальная длина">
              <Input
                type="number"
                min={1}
                max={200}
                value={draft.maxLength}
                onChange={(e) => setDraft((d) => ({ ...d, maxLength: Number(e.target.value) }))}
                className="w-28"
              />
            </Field>
          )}
          <p className="rounded-control bg-subtle px-3 py-2 font-mono text-xs">
            !set {draft.key || "ключ"} {typeMeta.example}
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
