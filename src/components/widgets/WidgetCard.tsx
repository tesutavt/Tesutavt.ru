"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmProvider";

interface WidgetCardProps {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  elementCount: number;
  overlayToken: string;
  updatedAt: string;
}

const ACCENT_COLORS = [
  "bg-violet-500",
  "bg-orange-500",
  "bg-success",
  "bg-sky-500",
  "bg-pink-500",
  "bg-warning",
];

function accentFor(id: string) {
  const sum = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return ACCENT_COLORS[sum % ACCENT_COLORS.length];
}

export function WidgetCard({
  id,
  name,
  canvasWidth,
  canvasHeight,
  elementCount,
  overlayToken,
  updatedAt,
}: WidgetCardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleDelete() {
    const ok = await confirm({
      title: "Удалить виджет?",
      description: `«${name}» будет удалён без возможности восстановления.`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    const res = await fetch(`/api/widgets/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  function handleCopy() {
    const url = `${window.location.origin}/overlay/${overlayToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[var(--surface)] p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentFor(id)}`}
        >
          <LayoutGrid size={20} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-[var(--surface-foreground)]">{name}</h3>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {canvasWidth}×{canvasHeight} · {elementCount}{" "}
            {elementCount === 1 ? "элемент" : "элементов"}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Удалить"
          className="shrink-0 rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">
        Обновлён: {new Date(updatedAt).toLocaleString()}
      </p>

      <div className="mt-auto flex gap-2">
        <Link
          href={`/dashboard/widgets/${id}`}
          className="flex-1 rounded-full bg-[var(--ink)] px-4 py-2 text-center text-sm font-medium text-[var(--ink-foreground)] transition hover:opacity-90"
        >
          Редактировать
        </Link>
        <button
          onClick={handleCopy}
          className="rounded-full bg-[var(--subtle)] px-4 py-2 text-sm font-medium text-[var(--surface-foreground)] transition hover:opacity-80"
        >
          {copied ? "Скопировано" : "OBS URL"}
        </button>
      </div>
    </div>
  );
}
