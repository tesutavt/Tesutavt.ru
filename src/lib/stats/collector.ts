import { prisma } from "@/lib/prisma";
import { getChannelSnapshot } from "@/lib/twitch-channel";

/** Календарный день статистики — по Москве (аудитория сайта русскоязычная). */
export const STATS_TIME_ZONE = "Europe/Moscow";

const HOUR_MS = 60 * 60_000;
const FIRST_RUN_DELAY_MS = 60_000;
const PAUSE_BETWEEN_USERS_MS = 2_000;

/** "2026-10-15" в часовом поясе статистики. */
export function statsDayKey(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STATS_TIME_ZONE }).format(date);
}

/** Полночь UTC этой даты — так Prisma хранит колонку @db.Date. */
export function dayKeyToDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

/**
 * Снимок числа фолловеров/подписчиков и пика зрителей в строку текущего
 * дня. Подписчиков и зрителей задним числом Twitch не отдаёт — поэтому
 * собираем их сами раз в час.
 */
export async function collectStatsForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twitchId: true } });
  if (!user) return;
  const snapshot = await getChannelSnapshot(userId, user.twitchId);
  if (!snapshot) return;

  const date = dayKeyToDate(statsDayKey());
  const existing = await prisma.channelStatDaily.findUnique({ where: { userId_date: { userId, date } } });
  const viewers = snapshot.live ? (snapshot.viewerCount ?? null) : null;
  const peakViewers =
    viewers === null ? (existing?.peakViewers ?? null) : Math.max(viewers, existing?.peakViewers ?? 0);

  const data = {
    followers: snapshot.followerCount ?? existing?.followers ?? null,
    subscribers: snapshot.subscriberCount ?? existing?.subscribers ?? null,
    peakViewers,
  };
  await prisma.channelStatDaily.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  });
}

async function collectAll() {
  const accounts = await prisma.account.findMany({
    where: { provider: "twitch" },
    select: { userId: true },
    distinct: ["userId"],
  });
  for (const { userId } of accounts) {
    await collectStatsForUser(userId).catch((err) => console.error("[stats] ошибка сбора:", userId, err));
    // Сервер маленький, Twitch ограничивает частоту — не опрашиваем всех разом.
    await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_USERS_MS));
  }
}

const globalForStats = globalThis as unknown as { __vtubeStatsTimer?: ReturnType<typeof setInterval> };

/** Раз в час собирает статистику всех каналов. Вызывается из instrumentation. */
export function startStatsCollector() {
  if (globalForStats.__vtubeStatsTimer) return;
  setTimeout(() => void collectAll(), FIRST_RUN_DELAY_MS);
  globalForStats.__vtubeStatsTimer = setInterval(() => void collectAll(), HOUR_MS);
}
