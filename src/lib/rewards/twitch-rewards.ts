import type { ChannelReward } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getValidBroadcasterToken } from "@/lib/twitch-token";

const HELIX_REWARDS = "https://api.twitch.tv/helix/channel_points/custom_rewards";

/** Скоупы стримера, без которых награды не работают. */
export const REWARD_SCOPES = ["channel:read:redemptions", "channel:manage:redemptions"];

export async function hasRewardScopes(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({ where: { userId, provider: "twitch" }, select: { scope: true } });
  const scopes = account?.scope?.split(/\s+/) ?? [];
  return REWARD_SCOPES.every((s) => scopes.includes(s));
}

type RewardFields = Pick<
  ChannelReward,
  | "title"
  | "cost"
  | "prompt"
  | "backgroundColor"
  | "isEnabled"
  | "isUserInputRequired"
  | "skipQueue"
  | "maxPerStream"
  | "maxPerUserPerStream"
  | "globalCooldownSeconds"
>;

function toTwitchBody(r: RewardFields) {
  return {
    title: r.title,
    cost: r.cost,
    prompt: r.prompt,
    background_color: r.backgroundColor,
    is_enabled: r.isEnabled,
    is_user_input_required: r.isUserInputRequired,
    should_redemptions_skip_request_queue: r.skipQueue,
    is_max_per_stream_enabled: r.maxPerStream !== null,
    max_per_stream: r.maxPerStream ?? 0,
    is_max_per_user_per_stream_enabled: r.maxPerUserPerStream !== null,
    max_per_user_per_stream: r.maxPerUserPerStream ?? 0,
    is_global_cooldown_enabled: r.globalCooldownSeconds !== null,
    global_cooldown_seconds: r.globalCooldownSeconds ?? 0,
  };
}

async function helix(userId: string, method: string, url: string, body?: unknown) {
  const token = await getValidBroadcasterToken(userId);
  if (!token) return { ok: false as const, status: 401, error: "Нет токена Twitch — перезайдите на сайт" };
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) {
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    return { ok: true as const, status: res.status, json };
  }
  const err = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: false as const, status: res.status, error: explainTwitchError(res.status, err.message ?? "") };
}

function explainTwitchError(status: number, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("partner or affiliate")) return "Награды за баллы доступны только компаньонам и партнёрам Twitch";
  if (m.includes("duplicate")) return "На канале уже есть награда с таким названием";
  if (status === 401 || m.includes("scope")) return "Нет доступа к наградам — нажмите «Перезайти» вверху страницы";
  if (status === 403) return "Эту награду создало не наше приложение — Twitch не даёт её менять";
  return message || `Ошибка Twitch (${status})`;
}

async function broadcasterId(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twitchId: true } });
  return user?.twitchId ?? null;
}

/**
 * Создаёт или обновляет награду на Twitch по данным из БД. Если награду
 * удалили на самом Twitch — создаёт заново. Результат (id или ошибку)
 * записывает в строку ChannelReward.
 */
export async function syncRewardToTwitch(reward: ChannelReward): Promise<ChannelReward> {
  const bid = await broadcasterId(reward.userId);
  if (!bid) return reward;

  let result = reward.twitchRewardId
    ? await helix(reward.userId, "PATCH", `${HELIX_REWARDS}?broadcaster_id=${bid}&id=${reward.twitchRewardId}`, toTwitchBody(reward))
    : null;

  if (!result || (!result.ok && result.status === 404)) {
    result = await helix(reward.userId, "POST", `${HELIX_REWARDS}?broadcaster_id=${bid}`, toTwitchBody(reward));
  }

  const twitchRewardId = result.ok
    ? ((result.json as { data?: { id: string }[] } | null)?.data?.[0]?.id ?? reward.twitchRewardId)
    : reward.twitchRewardId;

  return prisma.channelReward.update({
    where: { id: reward.id },
    data: { twitchRewardId, lastSyncError: result.ok ? null : result.error },
  });
}

export async function deleteRewardOnTwitch(reward: ChannelReward): Promise<void> {
  if (!reward.twitchRewardId) return;
  const bid = await broadcasterId(reward.userId);
  if (!bid) return;
  await helix(reward.userId, "DELETE", `${HELIX_REWARDS}?broadcaster_id=${bid}&id=${reward.twitchRewardId}`);
}

/** FULFILLED — выполнено, CANCELED — отменено, баллы возвращаются зрителю. */
export async function updateRedemptionStatus(
  userId: string,
  redemption: { id: string; twitchRewardId: string; broadcasterTwitchId: string },
  status: "FULFILLED" | "CANCELED"
): Promise<boolean> {
  const url =
    `${HELIX_REWARDS}/redemptions?broadcaster_id=${redemption.broadcasterTwitchId}` +
    `&reward_id=${redemption.twitchRewardId}&id=${redemption.id}`;
  const result = await helix(userId, "PATCH", url, { status });
  if (!result.ok) console.error("[rewards] не удалось сменить статус получения награды:", result.error);
  return result.ok;
}
