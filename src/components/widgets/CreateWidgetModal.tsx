"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function CreateWidgetModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createWidget() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не получилось создать виджет");
        return;
      }
      const widget = await res.json();
      router.push(`/dashboard/widgets/${widget.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> Создать виджет
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        icon={LayoutGrid}
        iconTone="accent"
        title="Новый виджет"
        description="Создастся пустой холст 1920×1080 — элементы (готовые пресеты или свой HTML/CSS/JS) добавляются уже в редакторе."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button loading={creating} onClick={createWidget}>
              Создать
            </Button>
          </>
        }
      >
        <Field label="Название" error={error}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, «Алерты»"
            onKeyDown={(e) => e.key === "Enter" && createWidget()}
          />
        </Field>
      </Modal>
    </>
  );
}
