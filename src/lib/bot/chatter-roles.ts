import type { IncomingChatMessage } from "@/lib/bot/command-engine";

export interface ChatterRoleFlags {
  isBroadcaster: boolean;
  isModerator: boolean;
  isVip: boolean;
  isSubscriber: boolean;
}

/**
 * "Плоские" роли для отображения (бейджи в чат-виджете) — НЕ то же самое,
 * что hasPermission() в command-engine.ts. Там роли образуют иерархию
 * нарочно (модератор обязан проходить проверку "только для сабов"), а
 * здесь каждый флаг — это ровно тот бейдж, который реально есть у
 * пользователя, иначе не-сab модератор красился бы в цвет саба в чате.
 */
export function getChatterRoleFlags(msg: IncomingChatMessage, broadcasterTwitchId: string): ChatterRoleFlags {
  const badges = msg.badgeSetIds;
  return {
    isBroadcaster: msg.chatterId === broadcasterTwitchId || badges.has("broadcaster"),
    isModerator: badges.has("moderator"),
    isVip: badges.has("vip"),
    isSubscriber: badges.has("subscriber") || badges.has("founder"),
  };
}
