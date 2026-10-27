"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Info, Lock, Plus, ShieldCheck, Trash2, UserCog, UserPlus } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Section } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

interface EditorView {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

const CAN = [
  "Виджеты и оверлеи",
  "Команды, таймеры, включение бота",
  "Награды за баллы",
  "Музыка и очередь",
  "Данные зрителей",
  "VTube Studio и триггеры",
  "Название и категория стрима",
];
const CANNOT = ["Секреты (API-ключи)", "Подключение и отвязка бот-аккаунта", "Токен Яндекс.Музыки", "Выдача доступа другим"];

export function AccessSection({ initialEditors }: { initialEditors: EditorView[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [editors, setEditors] = useState(initialEditors);
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grant() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/panel/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Не получилось выдать доступ");
      return;
    }
    setEditors((prev) => [...prev.filter((e) => e.id !== data.id), data]);
    toast.success(`Доступ выдан: ${data.displayName}`, "Пусть войдёт на сайт через свой Twitch и выберет вашу панель.");
    setLogin("");
    setOpen(false);
  }

  async function revoke(editor: EditorView) {
    const ok = await confirm({
      title: `Отозвать доступ у ${editor.displayName}?`,
      description: "Он сразу потеряет доступ к вашей панели. Выдать снова можно в любой момент.",
      confirmLabel: "Отозвать",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/panel/access/${editor.id}`, { method: "DELETE" });
    if (res.ok) {
      setEditors((prev) => prev.filter((e) => e.id !== editor.id));
      toast.success("Доступ отозван");
    } else toast.error("Не получилось отозвать доступ");
  }

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Редакторы панели"
        icon={UserCog}
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus size={16} /> Выдать доступ
          </Button>
        }
      >
        {editors.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="Доступ пока никому не выдан"
            description="Добавьте модератора по нику Twitch — он сможет настраивать бота, виджеты и награды прямо в вашей панели."
            action={
              <Button variant="secondary" onClick={() => setOpen(true)}>
                <Plus size={16} /> Выдать доступ
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {editors.map((e) => (
              <Card key={e.id} className="flex items-center gap-3 p-3">
                {e.avatarUrl ? (
                  <Image src={e.avatarUrl} alt={e.displayName} width={40} height={40} className="rounded-full" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-subtle font-semibold">
                    {e.displayName.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.displayName}</p>
                  <p className="text-xs text-muted">
                    @{e.login} · доступ с {new Date(e.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => revoke(e)}>
                  <Trash2 size={12} /> Отозвать
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-medium">
            <ShieldCheck size={18} className="text-success" /> Редактор может
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {CAN.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <Check size={14} className="shrink-0 text-success" /> {c}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-medium">
            <Lock size={18} className="text-muted" /> Только вы
          </p>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            {CANNOT.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <Lock size={12} className="shrink-0" /> {c}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon={UserPlus}
        iconTone="accent"
        title="Выдать доступ к панели"
        description="Редактор входит на сайт через свой Twitch и переключается на вашу панель кнопкой с аватаром в правом верхнем углу."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button loading={saving} onClick={grant} disabled={!login.trim()}>
              Выдать доступ
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Ник на Twitch" error={error} hint="Можно вставить ссылку на канал — ник возьмётся из неё.">
            <Input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login.trim() && grant()}
              placeholder="moderator_name"
              className="font-mono"
            />
          </Field>
          <p className="flex items-start gap-2 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            Выдавайте доступ только тем, кому доверяете: редактор меняет название стрима, команды и награды от имени
            вашего канала.
          </p>
        </div>
      </Modal>
    </div>
  );
}
