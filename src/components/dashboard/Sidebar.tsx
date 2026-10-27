"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_ORDER, OWNER_ONLY_PAGES, PAGES } from "@/config/navigation";

interface SidebarProps {
  onSignOut: () => Promise<void>;
  /** Открыта чужая панель — скрываем разделы только для владельца. */
  delegated?: boolean;
}

const ITEM =
  "group flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors duration-150";

export function Sidebar({ onSignOut, delegated = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-4 my-4 ml-4 flex h-[calc(100vh-2rem)] w-[4.5rem] shrink-0 flex-col justify-between rounded-[28px] bg-[var(--sidebar)] px-3.5 py-6 text-[var(--sidebar-foreground)] lg:w-60">
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3 px-0.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--sidebar-active)] text-base font-bold text-[var(--sidebar-active-foreground)]">
            V
          </div>
          <span className="hidden text-base font-semibold tracking-tight lg:inline">VtubeOverlay</span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ORDER.filter((key) => !delegated || !OWNER_ONLY_PAGES.includes(key)).map((key) => {
            const item = PAGES[key];
            const active =
              item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`${ITEM} ${
                  active
                    ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]"
                    : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-foreground)]"
                }`}
              >
                <Icon size={20} strokeWidth={2} className="shrink-0 transition-transform group-hover:scale-110" />
                <span className="hidden truncate lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <form action={onSignOut}>
        <button
          type="submit"
          title="Выйти"
          className={`${ITEM} w-full text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-foreground)]`}
        >
          <LogOut size={20} strokeWidth={2} className="shrink-0" />
          <span className="hidden lg:inline">Выйти</span>
        </button>
      </form>
    </aside>
  );
}
