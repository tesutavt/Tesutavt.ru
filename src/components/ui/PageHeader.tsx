import { PAGES, type PageKey } from "@/config/navigation";

/**
 * Заголовок страницы дашборда. Название, описание и иконка берутся из
 * src/config/navigation.ts — <PageHeader page="bot" />; title/description
 * можно переопределить. actions — кнопки справа.
 */
export function PageHeader({
  page,
  title,
  description,
  actions,
}: {
  page?: PageKey;
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const meta = page ? PAGES[page] : undefined;
  const Icon = meta?.icon;
  const heading = title ?? meta?.label ?? "";
  const subtitle = description ?? meta?.description;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {Icon && (
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-surface-foreground shadow-card sm:flex">
            <Icon size={22} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{heading}</h1>
          {subtitle && <p className="mt-0.5 max-w-3xl text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Стандартная обёртка содержимого страницы: заголовок + вертикальные отступы. */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-8">{children}</div>;
}
