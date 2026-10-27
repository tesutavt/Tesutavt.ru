import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { collectStatsForUser, dayKeyToDate, statsDayKey } from "@/lib/stats/collector";
import { getFollowsByDay } from "@/lib/stats/followers";

export const dynamic = "force-dynamic";

export interface StatsDay {
  date: string;
  newFollowers: number | null;
  followers: number | null;
  subscribers: number | null;
  peakViewers: number | null;
}

/** Статистика за месяц: ?month=2026-10 (по умолчанию текущий). */
export async function GET(req: NextRequest) {
  const session = await panelSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const todayKey = statsDayKey();
  const requested = req.nextUrl.searchParams.get("month") ?? todayKey.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(requested)) return NextResponse.json({ error: "month=YYYY-MM" }, { status: 400 });

  const [year, month] = requested.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const keys: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${requested}-${String(d).padStart(2, "0")}`;
    if (key > todayKey) break;
    keys.push(key);
  }
  if (!keys.length) return NextResponse.json({ month: requested, days: [], followsComplete: true, trackingSince: null });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twitchId: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Текущий месяц: свежий снимок за сегодня, чтобы график не ждал часового сбора.
  if (requested === todayKey.slice(0, 7)) await collectStatsForUser(userId).catch(() => {});

  // Начало периода по Москве: полночь первого дня = 21:00 UTC предыдущего (UTC+3).
  const from = new Date(`${keys[0]}T00:00:00+03:00`);
  const [follows, rows, first] = await Promise.all([
    getFollowsByDay(userId, user.twitchId, from),
    prisma.channelStatDaily.findMany({
      where: { userId, date: { gte: dayKeyToDate(keys[0]), lte: dayKeyToDate(keys[keys.length - 1]) } },
    }),
    prisma.channelStatDaily.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  const byDay = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));

  const days: StatsDay[] = keys.map((key) => {
    const row = byDay.get(key);
    return {
      date: key,
      newFollowers: follows ? (follows.counts[key] ?? 0) : null,
      followers: row?.followers ?? null,
      subscribers: row?.subscribers ?? null,
      peakViewers: row?.peakViewers ?? null,
    };
  });

  return NextResponse.json({
    month: requested,
    days,
    followsComplete: follows?.complete ?? false,
    followsAvailable: Boolean(follows),
    trackingSince: first ? first.date.toISOString().slice(0, 10) : null,
  });
}
