"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: LucideIcon;
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Опции живут отдельно от open — чтобы текст не пропадал, пока окно
  // доигрывает анимацию закрытия.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((result: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolveRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(next);
      setOpen(true);
    });
  }, []);

  function handle(result: boolean) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOpen(false);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={open}
        onClose={() => handle(false)}
        size="sm"
        icon={options?.icon ?? (options?.danger ? AlertTriangle : HelpCircle)}
        iconTone={options?.danger ? "danger" : "accent"}
        title={options?.title}
        description={options?.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => handle(false)}>
              {options?.cancelLabel ?? "Отмена"}
            </Button>
            <Button
              data-autofocus
              onClick={() => handle(true)}
              className={options?.danger ? "!bg-danger !text-white" : ""}
            >
              {options?.confirmLabel ?? "Подтвердить"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

/** const confirm = useConfirm(); if (await confirm({ title: "Удалить?" })) … */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
