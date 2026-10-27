"use client";

import { useState } from "react";
import { KeyRound, Lock, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, IconTile, Notice, Section } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

interface SecretView {
  id: string;
  name: string;
  masked: string;
}

/** API-ключи для HTTP-блоков Blueprint: {secret:ИМЯ}. Значение после сохранения не показывается. */
export function SecretsSection({
  initialSecrets,
  readOnly = false,
}: {
  initialSecrets: SecretView[];
  /** Редактор чужой панели: секреты владельца ему недоступны. */
  readOnly?: boolean;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [secrets, setSecrets] = useState(initialSecrets);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replacing, setReplacing] = useState<SecretView | null>(null);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setReplacing(null);
    setName("");
    setValue("");
    setError(null);
    setDialogOpen(true);
  }

  function openReplace(secret: SecretView) {
    setReplacing(secret);
    setName(secret.name);
    setValue("");
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!name || !value) {
      setError("Заполните имя и значение");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/bot/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, value }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Не получилось сохранить");
      return;
    }
    setSecrets((list) =>
      [...list.filter((s) => s.name !== data.name), data].sort((a, b) => a.name.localeCompare(b.name))
    );
    toast.success(replacing ? `Секрет ${data.name} заменён` : `Секрет ${data.name} сохранён`);
    setDialogOpen(false);
  }

  async function remove(secret: SecretView) {
    const ok = await confirm({
      title: `Удалить секрет ${secret.name}?`,
      description: "Блоки Blueprint, которые его используют, перестанут получать ключ.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/bot/secrets/${secret.id}`, { method: "DELETE" });
    if (res.ok) {
      setSecrets((list) => list.filter((s) => s.id !== secret.id));
      toast.success("Секрет удалён");
    } else toast.error("Не получилось удалить секрет");
  }

  return (
    <Section
      title="Секреты"
      icon={KeyRound}
      description={
        <>
          API-ключи для блока «HTTP-запрос» в Blueprint. В URL, заголовках или теле пишите{" "}
          <code className="font-mono text-surface-foreground">{"{secret:ИМЯ}"}</code>.
        </>
      }
      actions={
        !readOnly && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Новый секрет
          </Button>
        )
      }
    >
      {readOnly ? (
        <Notice icon={Lock} title="Секреты видит только владелец канала">
          Вы редактируете чужую панель. Ключи и токены владельца недоступны редакторам.
        </Notice>
      ) : secrets.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Секретов пока нет"
          description="Например, ключ погодного API: сохраните его как WEATHER_KEY и используйте в Blueprint-команде !погода."
          action={
            <Button variant="secondary" onClick={openCreate}>
              <Plus size={16} /> Добавить секрет
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {secrets.map((s) => (
            <Card key={s.id} className="flex items-center gap-3 p-3">
              <IconTile icon={KeyRound} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium">{s.name}</p>
                <p className="truncate font-mono text-xs text-muted">{s.masked}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openReplace(s)}>
                <RefreshCw size={12} /> Заменить
              </Button>
              <Button variant="danger" size="icon" onClick={() => remove(s)} title="Удалить">
                <Trash2 size={16} />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={KeyRound}
        iconTone="accent"
        title={replacing ? `Заменить ${replacing.name}` : "Новый секрет"}
        description="Значение хранится на сервере, в чат не попадает и после сохранения больше не показывается."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button loading={saving} onClick={save}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {!replacing && (
            <Field label="Имя" hint="Латиница, цифры и _, например WEATHER_KEY">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, "").toUpperCase())}
                placeholder="WEATHER_KEY"
                className="font-mono"
              />
            </Field>
          )}
          <Field label={replacing ? "Новое значение" : "Значение"} error={error}>
            <Input
              type="password"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="••••••••"
              className="font-mono"
            />
          </Field>
          {name && (
            <p className="text-xs text-muted">
              В Blueprint: <code className="font-mono text-surface-foreground">{`{secret:${name}}`}</code>
            </p>
          )}
        </div>
      </Modal>
    </Section>
  );
}
