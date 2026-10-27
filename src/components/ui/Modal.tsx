"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";

const EXIT_MS = 160; // = --motion-fast в theme.css

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

const ICON_TONES = {
  neutral: "bg-subtle text-surface-foreground",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  iconTone?: keyof typeof ICON_TONES;
  size?: keyof typeof SIZES;
  /** Кнопки внизу окна (выравниваются вправо). */
  footer?: React.ReactNode;
  /** false — окно нельзя закрыть кликом по фону / Esc / крестиком. */
  dismissible?: boolean;
  /** Убрать внутренние отступы тела (для редакторов кода и т.п.). */
  bare?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Общее диалоговое окно сайта: портал в <body>, затемнение фона, анимации
 * появления/исчезновения из theme.css, Esc и клик по фону закрывают,
 * прокрутка страницы под окном блокируется.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  iconTone = "neutral",
  size = "md",
  footer,
  dismissible = true,
  bare,
  className = "",
  children,
}: ModalProps) {
  // Держим окно смонтированным, пока доигрывает анимация закрытия.
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  if (open && !rendered) {
    setRendered(true);
    setClosing(false);
  }
  if (!open && rendered && !closing) {
    setClosing(true);
  }

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Фокус внутрь окна: на первое поле ввода, иначе на саму панель.
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>("input, textarea, select, [data-autofocus]");
    (firstField ?? panel)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, dismissible]);

  if (!rendered || typeof document === "undefined") return null;

  const hasHeader = Boolean(title || Icon);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px] ${closing ? "anim-overlay-out" : "anim-overlay-in"}`}
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-dialog bg-surface text-surface-foreground shadow-dialog outline-none ${SIZES[size]} ${closing ? "anim-dialog-out" : "anim-dialog-in"} ${className}`}
      >
        {hasHeader && (
          <div className="flex items-start gap-3 px-6 pt-6">
            {Icon && (
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${ICON_TONES[iconTone]}`}
              >
                <Icon size={20} />
              </div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              {title && <h3 className="text-lg font-semibold leading-tight">{title}</h3>}
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            {dismissible && (
              <button
                onClick={onClose}
                aria-label="Закрыть"
                className="-mr-2 -mt-1 rounded-control p-1.5 text-muted transition hover:bg-subtle hover:text-surface-foreground"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {children && (
          <div className={bare ? "flex min-h-0 flex-1 flex-col" : `min-h-0 flex-1 overflow-y-auto px-6 ${hasHeader ? "pt-4" : "pt-6"} ${footer ? "pb-2" : "pb-6"}`}>
            {children}
          </div>
        )}

        {footer && <div className="flex flex-wrap justify-end gap-2 px-6 pb-6 pt-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
