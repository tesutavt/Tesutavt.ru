"use client";

import { createContext, useCallback, useContext, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastTone = "info" | "success" | "warning" | "error";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  leaving?: boolean;
}

interface ToastApi {
  (title: string, options?: { tone?: ToastTone; description?: string; durationMs?: number }): void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
const ICON_TONES = { info: "text-accent", success: "text-success", warning: "text-warning", error: "text-danger" };

const noopSubscribe = () => () => {};

const ToastContext = createContext<ToastApi | null>(null);

/** Всплывающие уведомления в правом нижнем углу: toast.success("Сохранено"). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 220);
  }, []);

  const [api] = useState<ToastApi>(() => {
    const show = ((title, options) => {
      const id = nextId.current++;
      const tone = options?.tone ?? "info";
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, description: options?.description }]);
      setTimeout(() => dismiss(id), options?.durationMs ?? (tone === "error" ? 6000 : 3500));
    }) as ToastApi;
    show.success = (title, description) => show(title, { tone: "success", description });
    show.error = (title, description) => show(title, { tone: "error", description });
    show.info = (title, description) => show(title, { tone: "info", description });
    show.warning = (title, description) => show(title, { tone: "warning", description });
    return show;
  });

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
            {toasts.map((t) => {
              const Icon = ICONS[t.tone];
              return (
                <div
                  key={t.id}
                  role="status"
                  className={`pointer-events-auto flex items-start gap-3 rounded-card border border-border bg-surface p-3.5 text-surface-foreground shadow-dialog ${t.leaving ? "anim-toast-out" : "anim-toast-in"}`}
                >
                  <Icon size={18} className={`mt-0.5 shrink-0 ${ICON_TONES[t.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                  </div>
                  <button
                    onClick={() => dismiss(t.id)}
                    aria-label="Закрыть"
                    className="rounded-md p-0.5 text-muted transition hover:text-surface-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
