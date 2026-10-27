import { getValidBroadcasterToken } from "@/lib/twitch-token";
import { statsDayKey } from "@/lib/stats/collector";

const PAGE_SIZE = 100;
/** Не больше 50 страниц (5000 фолловеров) за запрос — защита от огромных каналов. */
const MAX_PAGES = 50;
const CACHE_MS = 10 * 60_000;

interface FollowPage {
  data: { followed_at: string }[];
  pagination?: { cursor?: string };
}

export interface FollowsByDay {
  /** "2026-10-15" -> сколько человек зафолловили в этот день (из тех, кто фолловит до сих пор). */
  counts: Record<string, number>;
  /** Дошли ли до начала периода — false, если упёрлись в MAX_PAGES. */
  complete: boolean;
}

const cache = new Map<string, { at: number; value: FollowsByDay }>();

/**
 * Новые фолловеры по дням с даты from. Twitch отдаёт список текущих
 * фолловеров от новых к старым с датой followed_at — листаем, пока не
 * уйдём раньше from. Отписавшихся в списке нет — это честная оговорка
 * для графика.
 */
export async function getFollowsByDay(userId: string, broadcasterTwitchId: string, from: Date): Promise<FollowsByDay | null> {
  const key = `${userId}:${from.toISOString()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const token = await getValidBroadcasterToken(userId);
  if (!token) return null;

  const counts: Record<string, number> = {};
  let cursor: string | undefined;
  let complete = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL("https://api.twitch.tv/helix/channels/followers");
    url.searchParams.set("broadcaster_id", broadcasterTwitchId);
    url.searchParams.set("first", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("after", cursor);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Client-Id": process.env.TWITCH_CLIENT_ID! },
    });
    if (!res.ok) return page === 0 ? null : { counts, complete: false };
    const body = (await res.json()) as FollowPage;

    let reachedStart = false;
    for (const follow of body.data) {
      const at = new Date(follow.followed_at);
      if (at < from) {
        reachedStart = true;
        break;
      }
      const day = statsDayKey(at);
      counts[day] = (counts[day] ?? 0) + 1;
    }

    cursor = body.pagination?.cursor;
    if (reachedStart || !cursor || body.data.length < PAGE_SIZE) {
      complete = true;
      break;
    }
  }

  const value = { counts, complete };
  cache.set(key, { at: Date.now(), value });
  return value;
}
