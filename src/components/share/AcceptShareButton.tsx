"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptShareButton({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function accept() {
    setStatus("loading");
    const res = await fetch(`/api/share/${token}/accept`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/widgets/${data.widgetId}`);
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={accept}
        disabled={status === "loading"}
        className="w-full rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-medium text-[var(--ink-foreground)] transition hover:opacity-90 disabled:opacity-50"
      >
        {status === "loading" ? "Добавляем…" : "Принять и добавить себе"}
      </button>
      {status === "error" && (
        <p className="text-center text-xs text-danger">Не получилось добавить виджет. Попробуйте ещё раз.</p>
      )}
    </div>
  );
}
