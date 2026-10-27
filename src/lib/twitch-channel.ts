import { getValidBroadcasterToken } from "@/lib/twitch-token";
import { containsBannedWord, BANNED_WORD_ERROR } from "@/lib/moderation/banned-words";
import { prisma } from "@/lib/prisma";

async function helixFetch(url: string, token: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
    },
  });
}

export interface ChannelInfo {
  title: string;
  gameName: string;
}

export async function getChannelInfo(
  token: string,
  broadcasterTwitchId: string
): Promise<ChannelInfo | null> {
  const res = await helixFetch(
    `https://api.twitch.tv/helix/channels?broadcaster_id=${broadcasterTwitchId}`,
    token
  );
  if (!res.ok) return null;
  const { data } = (await res.json()) as { data: { title: string; game_name: string }[] };
  const channel = data[0];
  return channel ? { title: channel.title, gameName: channel.game_name } : null;
}

export async function setChannelTitle(
  token: string,
  broadcasterTwitchId: string,
  title: string
): Promise<boolean> {
  // Последний рубеж: и !title из чата, и форма на сайте проходят здесь.
  if (containsBannedWord(title)) return false;
  const res = await helixFetch("https://api.twitch.tv/helix/channels", token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ broadcaster_id: broadcasterTwitchId, title }),
  });
  return res.ok;
}

export async function findGameByName(
  token: string,
  name: string
): Promise<{ id: string; name: string } | null> {
  const res = await helixFetch(
    `https://api.twitch.tv/helix/games?name=${encodeURIComponent(name)}`,
    token
  );
  if (!res.ok) return null;
  const { data } = (await res.json()) as { data: { id: string; name: string }[] };
  return data[0] ?? null;
}

export async function setChannelGame(
  token: string,
  broadcasterTwitchId: string,
  gameId: string
): Promise<boolean> {
  const res = await helixFetch("https://api.twitch.tv/helix/channels", token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ broadcaster_id: broadcasterTwitchId, game_id: gameId }),
  });
  return res.ok;
}

export async function getFollowerCount(
  token: string,
  broadcasterTwitchId: string
): Promise<number | null> {
  const res = await helixFetch(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterTwitchId}&first=1`,
    token
  );
  if (!res.ok) return null;
  const { total } = (await res.json()) as { total: number };
  return total;
}

/** Returns null if the broadcaster token lacks channel:read:subscriptions. */
export async function getSubscriberCount(
  token: string,
  broadcasterTwitchId: string
): Promise<number | null> {
  const res = await helixFetch(
    `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterTwitchId}&first=1`,
    token
  );
  if (!res.ok) return null;
  const { total } = (await res.json()) as { total: number };
  // Twitch иногда отдаёт total: -1 (нет доступа к списку) — это «нет данных», а не число.
  return Number.isFinite(total) && total >= 0 ? total : null;
}

export interface StreamStatus {
  live: boolean;
  viewerCount: number | null;
}

export async function getStreamStatus(
  token: string,
  broadcasterTwitchId: string
): Promise<StreamStatus> {
  const res = await helixFetch(
    `https://api.twitch.tv/helix/streams?user_id=${broadcasterTwitchId}`,
    token
  );
  if (!res.ok) return { live: false, viewerCount: null };
  const { data } = (await res.json()) as { data: { viewer_count: number }[] };
  const stream = data[0];
  return stream ? { live: true, viewerCount: stream.viewer_count } : { live: false, viewerCount: null };
}

export interface ChannelSnapshot {
  title: string | null;
  gameName: string | null;
  followerCount: number | null;
  subscriberCount: number | null;
  live: boolean;
  viewerCount: number | null;
}

export async function getChannelSnapshot(
  userId: string,
  broadcasterTwitchId: string
): Promise<ChannelSnapshot | null> {
  const token = await getValidBroadcasterToken(userId);
  if (!token) return null;

  const [channel, followerCount, subscriberCount, stream] = await Promise.all([
    getChannelInfo(token, broadcasterTwitchId),
    getFollowerCount(token, broadcasterTwitchId),
    getSubscriberCount(token, broadcasterTwitchId),
    getStreamStatus(token, broadcasterTwitchId),
  ]);

  return {
    title: channel?.title ?? null,
    gameName: channel?.gameName ?? null,
    followerCount,
    subscriberCount,
    live: stream.live,
    viewerCount: stream.viewerCount,
  };
}

export async function updateChannelInfo(
  userId: string,
  broadcasterTwitchId: string,
  patch: { title?: string; game?: string }
): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidBroadcasterToken(userId);
  if (!token) return { ok: false, error: "Нет доступа к каналу — перелогиньтесь" };

  if (patch.title !== undefined) {
    if (containsBannedWord(patch.title)) return { ok: false, error: BANNED_WORD_ERROR };
    const ok = await setChannelTitle(token, broadcasterTwitchId, patch.title);
    if (!ok) return { ok: false, error: "Не получилось сменить название" };
  }

  if (patch.game !== undefined && patch.game.trim()) {
    const game = await findGameByName(token, patch.game.trim());
    if (!game) return { ok: false, error: `Категория "${patch.game}" не найдена` };
    const ok = await setChannelGame(token, broadcasterTwitchId, game.id);
    if (!ok) return { ok: false, error: "Не получилось сменить категорию" };
  }

  return { ok: true };
}

/** Форма, которую ждёт window.widget.channel у виджетов (см. twitch-fields.ts
 * CHANNEL_FIELDS/buildSampleChannel) - но с настоящими данными вместо
 * заглушки. Используется на реальном /overlay/[token] и при его поллинге
 * (см. OverlayLiveEvents.tsx) - в редакторе по-прежнему buildSampleChannel(). */
export interface RealChannelSnapshot {
  displayName: string;
  login: string;
  id: string;
  avatarUrl: string | null;
  followerCount: number;
  title: string;
  game: string;
  isLive: boolean;
}

export async function resolveWidgetChannel(userId: string): Promise<RealChannelSnapshot | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const snapshot = await getChannelSnapshot(userId, user.twitchId);
  return {
    displayName: user.displayName,
    login: user.login,
    id: user.twitchId,
    avatarUrl: user.avatarUrl,
    followerCount: snapshot?.followerCount ?? 0,
    title: snapshot?.title ?? "",
    game: snapshot?.gameName ?? "",
    isLive: snapshot?.live ?? false,
  };
}
