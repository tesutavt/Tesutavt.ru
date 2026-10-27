import { prisma } from "@/lib/prisma";
import { runBlueprint } from "@/lib/blueprint/execute";
import type { BpGraph } from "@/lib/blueprint/types";
import { sendChatMessage } from "@/lib/bot/chat";
import { getValidBotToken } from "@/lib/twitch-token";
import { publishOverlayEvent } from "@/lib/bot/event-bus";

export const REDEMPTION_EVENT_TYPE = "channel.channel_points_custom_reward_redemption.add";

export interface RedemptionEvent {
  id: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  user_id: string;
  user_login: string;
  user_name: string;
  user_input?: string;
  reward: { id: string; title: string; cost: number; prompt?: string };
}

// Twitch может прислать одно событие повторно (webhook ретраи, миграция
// WebSocket-сессии) — без этого награда сработала бы дважды.
const globalForRedemptions = globalThis as unknown as { __vtubeSeenRedemptions: Set<string> | undefined };
const seen = globalForRedemptions.__vtubeSeenRedemptions ?? new Set<string>();
globalForRedemptions.__vtubeSeenRedemptions = seen;

export async function handleRedemption(userId: string, botTwitchId: string, event: RedemptionEvent) {
  if (seen.has(event.id)) return;
  seen.add(event.id);
  if (seen.size > 500) {
    const oldest = seen.values().next().value;
    if (oldest) seen.delete(oldest);
  }

  const input = event.user_input ?? "";
  // Виджеты оверлея могут реагировать на любую награду (не только созданную здесь).
  publishOverlayEvent(userId, "rewardRedeemed", {
    user: event.user_name,
    input,
    reward: event.reward.title,
    cost: event.reward.cost,
  });

  const reward = await prisma.channelReward.findFirst({ where: { userId, twitchRewardId: event.reward.id } });
  if (!reward) return;
  await prisma.channelReward.update({ where: { id: reward.id }, data: { lastRedeemedAt: new Date() } });
  if (!reward.graph) return;

  const result = await runBlueprint(
    reward.graph as unknown as BpGraph,
    {
      vars: {
        user: event.user_name,
        input,
        // Алиасы, чтобы блоки, скопированные из команд, работали и тут.
        message: input,
        args: input,
        reward: event.reward.title,
        cost: String(event.reward.cost),
        channel: event.broadcaster_user_login,
      },
      viewer: { twitchId: event.user_id, login: event.user_login, name: event.user_name },
      redemption: { id: event.id, twitchRewardId: event.reward.id, broadcasterTwitchId: event.broadcaster_user_id },
    },
    userId
  );
  if (result.error) console.error(`[rewards] ошибка в графе награды «${reward.title}»:`, result.error);

  if (!result.sentMessages.length) return;
  const token = await getValidBotToken(userId);
  if (!token) return;
  for (const text of result.sentMessages) {
    await sendChatMessage(token, event.broadcaster_user_id, botTwitchId, text);
  }
}
