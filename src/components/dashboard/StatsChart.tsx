"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface StatsDay {
  date: string;
  newFollowers: number | null;
  followers: number | null;
  subscribers: number | null;
  peakViewers: number | null;
}

interface StatsResponse {
  month: string;
  days: StatsDay[];
  followsComplete: boolean;
  followsAvailable: boolean;
  trackingSince: string | null;
}

type Metric = "followers" | "subscribers" | "viewers";

const TABS: { key: Metric; label: string }[] = [
  { key: "followers", label: "Новые фолловеры" },
  { key: "subscribers", label: "Подписчики" },
  { key: "viewers", label: "Пик зрителей" },
];

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function monthKey(offset: number) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function dayLabel(key: string) {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS_GEN[m - 1]}`;
}

function valueOf(day: StatsDay, metric: Metric) {
  if (metric === "followers") return day.newFollowers;
  if (metric === "subscribers") return day.subscribers;
  return day.peakViewers;
}

/** «Красивый» верх шкалы: 1, 2, 5 × 10ⁿ. */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * pow >= value) return step * pow;
  return 10 * pow;
}

const nf = new Intl.NumberFormat("ru-RU");

export function StatsChart() {
  const [offset, setOffset] = useState(0);
  const [metric, setMetric] = useState<Metric>("followers");
  const [data, setData] = useState<StatsResponse | null>(null);
  // Месяц, для которого загрузка упала — ошибка «привязана» к месяцу и
  // сама пропадает при переключении.
  const [errorMonth, setErrorMonth] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const month = monthKey(offset);
  const error = errorMonth === month;
  const loading = !error && data?.month !== month;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stats?month=${month}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: StatsResponse) => !cancelled && setData(body))
      .catch(() => !cancelled && setErrorMonth(month));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const days = data?.month === month ? data.days : [];
  const values = days.map((d) => valueOf(d, metric));
  const known = values.filter((v): v is number => v !== null);
  const max = niceMax(Math.max(0, ...known));

  let summary: { value: number; caption: string } | null = null;
  if (known.length) {
    if (metric === "followers") summary = { value: known.reduce((a, b) => a + b, 0), caption: "новых за месяц" };
    else if (metric === "viewers") summary = { value: Math.max(...known), caption: "максимум за месяц" };
    else {
      const first = known[0];
      const last = known[known.length - 1];
      const delta = last - first;
      summary = { value: last, caption: delta ? `${delta > 0 ? "+" : ""}${delta} за месяц` : "сейчас" };
    }
  }

  const emptyText =
    metric === "followers"
      ? data && !data.followsAvailable
        ? "Нет доступа к списку фолловеров — владельцу канала нужно перезайти на сайт."
        : "В этом месяце новых фолловеров нет."
      : data?.trackingSince
        ? `Twitch не хранит историю ${metric === "subscribers" ? "подписчиков" : "зрителей"} — мы собираем её сами с ${dayLabel(data.trackingSince)}. Здесь пока пусто.`
        : `Twitch не хранит историю ${metric === "subscribers" ? "подписчиков" : "зрителей"} — сбор начат, график заполнится в ближайшие дни.`;

  const hovered = hover !== null ? days[hover] : null;
  const asLine = metric === "subscribers";
  const points = values
    .map((v, i) => (v === null ? null : `${((i + 0.5) / days.length) * 100},${100 - (v / max) * 100}`))
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={metric === t.key}
              onClick={() => setMetric(t.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                metric === t.key ? "bg-ink text-ink-foreground" : "text-muted hover:bg-subtle"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Предыдущий месяц"
            className="rounded-control p-1.5 text-muted transition hover:bg-subtle"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium">{monthLabel(month)}</span>
          <button
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset === 0}
            aria-label="Следующий месяц"
            className="rounded-control p-1.5 text-muted transition hover:bg-subtle disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{summary ? nf.format(summary.value) : "—"}</span>
        <span className="text-sm text-muted">{summary?.caption ?? TABS.find((t) => t.key === metric)!.label.toLowerCase()}</span>
        {loading && <Loader2 size={14} className="animate-spin text-muted" />}
      </div>

      <div className="relative h-56">
        {error ? (
          <Empty text="Не удалось загрузить статистику. Попробуйте обновить страницу." />
        ) : !loading && !known.length ? (
          <Empty text={emptyText} />
        ) : (
          <>
            {/* Сетка и подписи оси Y — приглушённые. */}
            <div className="pointer-events-none absolute inset-0 bottom-6 left-10">
              {[1, 0.5, 0].map((f) => (
                <div key={f} className="absolute left-0 right-0 border-t border-border" style={{ top: `${(1 - f) * 100}%` }}>
                  <span className="absolute -left-10 -top-2 w-8 text-right text-[10px] tabular-nums text-muted">
                    {nf.format(Math.round(max * f))}
                  </span>
                </div>
              ))}
            </div>

            <div className="absolute inset-0 bottom-6 left-10 flex">
              {asLine && points && (
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <polyline
                    points={points}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {days.map((day, i) => {
                const v = values[i];
                const h = v === null ? 0 : (v / max) * 100;
                return (
                  <div
                    key={day.date}
                    className="relative flex h-full flex-1 items-end justify-center px-px"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
                  >
                    {hover === i && <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />}
                    {asLine ? (
                      v !== null &&
                      hover === i && (
                        <span
                          className="absolute h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
                          style={{ bottom: `calc(${h}% - 5px)` }}
                        />
                      )
                    ) : (
                      <div
                        className={`relative w-full max-w-[18px] rounded-t-[4px] transition-[height,opacity] duration-300 ${
                          hover === null || hover === i ? "opacity-100" : "opacity-50"
                        }`}
                        style={{ height: `${h}%`, minHeight: v ? 2 : 0, background: "var(--accent)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Подписи дней: 1, 5, 10, 15… */}
            <div className="absolute bottom-0 left-10 right-0 flex h-5">
              {days.map((day, i) => {
                const d = Number(day.date.slice(8));
                return (
                  <span key={day.date} className="flex-1 text-center text-[10px] tabular-nums text-muted">
                    {d === 1 || d % 5 === 0 || i === days.length - 1 ? d : ""}
                  </span>
                );
              })}
            </div>

            {hovered && hover !== null && (
              <div className="pointer-events-none absolute inset-0 bottom-6 left-10">
                <div
                  className="absolute top-0 z-10 whitespace-nowrap rounded-control border border-border bg-surface px-3 py-2 text-xs shadow-dialog"
                  style={{
                    left: `${((hover + 0.5) / days.length) * 100}%`,
                    transform: hover > days.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
                  }}
                >
                  <p className="font-medium">{dayLabel(hovered.date)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-muted">
                    <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                    {TABS.find((t) => t.key === metric)!.label}:{" "}
                    <span className="font-medium tabular-nums text-surface-foreground">
                      {valueOf(hovered, metric) === null ? "нет данных" : nf.format(valueOf(hovered, metric)!)}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {metric === "followers" && data && data.followsAvailable && (
        <p className="text-xs text-muted">
          Считаются те, кто фолловит канал сейчас — отписавшихся Twitch не показывает.
          {!data.followsComplete && " Показаны последние 5000 фолловеров."}
        </p>
      )}
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-control border border-dashed border-border px-6">
      <p className="max-w-sm text-center text-sm text-muted">{text}</p>
    </div>
  );
}
