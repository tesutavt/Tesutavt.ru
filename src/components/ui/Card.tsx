import type { LucideIcon } from "lucide-react";

export function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-card bg-surface text-surface-foreground shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Квадратная плашка с иконкой — для заголовков карточек и строк списков. */
export function IconTile({
  icon: Icon,
  tone = "neutral",
  size = "md",
}: {
  icon: LucideIcon;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md";
}) {
  const tones = {
    neutral: "bg-subtle text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  const box = size === "sm" ? "h-9 w-9 rounded-control" : "h-10 w-10 rounded-control";
  return (
    <div className={`flex shrink-0 items-center justify-center ${box} ${tones[tone]}`}>
      <Icon size={size === "sm" ? 16 : 18} />
    </div>
  );
}

/** Секция страницы: заголовок, описание, действия справа и содержимое. */
export function Section({
  title,
  description,
  icon,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icon;
  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            {Icon && <Icon size={18} className="text-muted" />}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Пустое состояние списка. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle text-muted">
          <Icon size={22} />
        </div>
      )}
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Цветная плашка-подсказка (инфо/предупреждение/ошибка/успех). */
export function Notice({
  tone = "neutral",
  icon: Icon,
  title,
  children,
  action,
}: {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  icon?: LucideIcon;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const tones = {
    neutral: "border-border bg-surface text-surface-foreground",
    accent: "border-accent/30 bg-accent-soft text-surface-foreground",
    success: "border-success/30 bg-success-soft text-surface-foreground",
    warning: "border-warning/40 bg-warning-soft text-surface-foreground",
    danger: "border-danger/40 bg-danger-soft text-surface-foreground",
  };
  const iconTones = {
    neutral: "text-muted",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <div className={`flex items-start gap-3 rounded-card border p-4 text-sm ${tones[tone]}`}>
      {Icon && <Icon size={18} className={`mt-0.5 shrink-0 ${iconTones[tone]}`} />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-muted" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
