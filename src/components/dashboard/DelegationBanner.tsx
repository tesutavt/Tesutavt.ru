"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, PenLine } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Полоса над страницей, пока пользователь редактирует чужую панель. */
export function DelegationBanner({ ownerName, ownerLogin }: { ownerName: string; ownerLogin: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function backToMine() {
    setBusy(true);
    await fetch("/api/panel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: null }),
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="anim-page-in mb-6 flex flex-wrap items-center gap-3 rounded-card border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-surface-foreground">
      <PenLine size={18} className="shrink-0 text-warning" />
      <p className="min-w-[200px] flex-1">
        Вы редактируете панель <b>{ownerName}</b> <span className="text-muted">(@{ownerLogin})</span> — все изменения
        применяются к данным этого канала.
      </p>
      <Button variant="secondary" size="sm" loading={busy} onClick={backToMine}>
        <ArrowLeftRight size={12} /> К своей панели
      </Button>
    </div>
  );
}
