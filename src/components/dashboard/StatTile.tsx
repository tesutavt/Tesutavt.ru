import type { LucideIcon } from "lucide-react";

interface StatTileProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  accent?: string;
}

export function StatTile({ icon: Icon, value, label, accent = "text-violet-500" }: StatTileProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--surface)] p-5 text-center shadow-card">
      <Icon size={20} className={accent} />
      <div className="text-2xl font-bold text-[var(--surface-foreground)]">{value}</div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}
