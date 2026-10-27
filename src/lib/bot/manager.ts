import { prisma } from "@/lib/prisma";
import { getValidBotToken, getValidBroadcasterToken } from "@/lib/twitch-token";
import { ChatEventSubClient, toIncomingChatMessage, type ChatMessageEvent } from "@/lib/bot/eventsub-client";
import {
  ensureChatWebhook,
  removeChatWebhook,
  isWebhookTransportAvailable,
  ensureRedemptionWebhook,
  removeRedemptionWebhook,
} from "@/lib/bot/eventsub-webhook";
import { EventSubSocketClient } from "@/lib/bot/eventsub-socket";
import { handleRedemption, REDEMPTION_EVENT_TYPE, type RedemptionEvent } from "@/lib/rewards/redemption-handler";
import { hasRewardScopes } from "@/lib/rewards/twitch-rewards";
import { handleChatMessage, type IncomingChatMessage } from "@/lib/bot/command-engine";
import { sendChatMessage } from "@/lib/bot/chat";
import { getChatterRoleFlags } from "@/lib/bot/chatter-roles";
import { publishOverlayEvent } from "@/lib/bot/event-bus";

interface ActiveBot {
  userId: string;
  client: ChatEventSubClient | null;
  /** Подписка на награды за баллы по WebSocket (когда webhook недоступен). */
  rewardClient: EventSubSocketClient | null;
  /** Награды приходят через webhook — при остановке подписку нужно удалить. */
  rewardWebhook: boolean;
  onChatMessage: (msg: IncomingChatMessage) => void;
  webhookInit: ReturnType<typeof setTimeout> | null;
  webhookWatch: ReturnType<typeof setInterval> | null;
  seenMessageIds: Set<string>;
  botTwitchId: string;
  broadcasterTwitchId: string;
  timerTick: ReturnType<typeof setInterval> | null;
  startedAt: Date;
  /** Растёт на каждое сообщение чата (не только команды) — источник для
   *  "умного" порога срабатывания таймеров, см. runTimerTick(). */
  totalChatMessages: number;
  /** timerId -> значение totalChatMessages на момент последнего срабатывания
   *  этого таймера (или на момент старта бота, если ещё не срабатывал). */
  timerMessageBaseline: Map<string, number>;
}

// См. комментарий в event-bus.ts — та же причина: при hot reload в dev
// модуль может пересоздаться, и без анкоринга на globalThis старое
// WebSocket-соединение из предыдущего экземпляра остаётся жить и
// продолжает слать сообщения, а activeBots.has(userId) в новом экземпляре
// об этом не знает — startBotForUser не находит "уже запущенного" бота и
// поднимает ещё одно соединение поверх старого (отсюда задвоенные/учетверённые
// сообщения в чате при активной разработке).
const globalForBotManager = globalThis as unknown as {
  __vtubeActiveBots: Map<string, ActiveBot> | undefined;
};

const activeBots = globalForBotManager.__vtubeActiveBots ?? new Map<string, ActiveBot>();
globalForBotManager.__vtubeActiveBots = activeBots;

const TIMER_TICK_MS = 15_000;

export function isBotRunning(userId: string) {
  return activeBots.has(userId);
}

async function tokenScopes(token: string | null): Promise<string[] | null> {
  if (!token) return null;
  const res = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${token}` } });
  if (!res.ok) return null;
  const body = (await res.json()) as { scopes?: string[] };
  return body.scopes ?? [];
}

async function logMissingScopes(userId: string) {
  const [botScopes, broadcasterScopes] = await Promise.all([
    tokenScopes(await getValidBotToken(userId)),
    tokenScopes(await getValidBroadcasterToken(userId)),
  ]);
  const botMissing = ["user:read:chat", "user:write:chat", "user:bot"].filter((s) => !botScopes?.includes(s));
  const broadcasterMissing = ["channel:bot"].filter((s) => !broadcasterScopes?.includes(s));
  if (botMissing.length) {
    console.error(`[bot] у аккаунта бота нет скоупов: ${botMissing.join(", ")} - отключите и заново подключите бота в дашборде`);
  }
  if (broadcasterMissing.length) {
    console.error(`[bot] у аккаунта стримера нет скоупов: ${broadcasterMissing.join(", ")} - нажмите "Перезайти" на странице бота (или сделайте бота модератором канала)`);
  }
  if (!botMissing.length && !broadcasterMissing.length) {
    console.error("[bot] скоупы в порядке - если 403 остаётся, сделайте бота модератором канала или перезайдите стримером");
  }
}

function pickRandom<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Раз в TIMER_TICK_MS проверяет все включённые таймеры пользователя и
 * отправляет те, что готовы. Таймер готов, когда ОБА условия выполнены:
 * - прошло достаточно времени с последней отправки (intervalSeconds);
 * - в чате написали не меньше minMessages сообщений с последней отправки
 *   этого таймера (0 = без порога, ведёт себя как раньше).
 *
 * Список таймеров читается из БД на каждом тике, поэтому правки в
 * дашборде (текст/интервал/порог/вкл-выкл) подхватываются в течение
 * ближайших ~15 секунд без необходимости явно перезапускать бота.
 */
async function runTimerTick(userId: string) {
  const active = activeBots.get(userId);
  if (!active) return;

  const timers = await prisma.botTimer.findMany({ where: { userId, enabled: true } });
  if (!timers.length) return;

  const token = await getValidBotToken(userId);
  if (!token) return;

  for (const timer of timers) {
    const intervalMs = Math.max(30, timer.intervalSeconds) * 1000;
    const sinceReference = timer.lastSentAt ?? active.startedAt;
    if (Date.now() - sinceReference.getTime() < intervalMs) continue;

    const baseline = active.timerMessageBaseline.get(timer.id) ?? 0;
    const messagesSeen = active.totalChatMessages - baseline;
    if (messagesSeen < timer.minMessages) continue;

    const text = pickRandom(timer.messages);
    if (!text) continue; // таймер без текстов — пропускаем, не отправлять же пустое сообщение

    const result = await sendChatMessage(token, active.broadcasterTwitchId, active.botTwitchId, text);
    if (result.isSent) {
      await prisma.botTimer.update({ where: { id: timer.id }, data: { lastSentAt: new Date() } });
      active.timerMessageBaseline.set(timer.id, active.totalChatMessages);
    }
  }
}

export async function startBotForUser(userId: string) {
  if (activeBots.has(userId)) return;

  const [botAccount, user] = await Promise.all([
    prisma.botAccount.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!botAccount || !user) return;

  const broadcasterTwitchId = user.twitchId;
  const botTwitchId = botAccount.botTwitchId;

  const activeRef: { current: ActiveBot | undefined } = { current: undefined };

  const onChatMessage = (msg: IncomingChatMessage) => {
    const active = activeRef.current;
    if (active && msg.messageId) {
      if (active.seenMessageIds.has(msg.messageId)) return;
      active.seenMessageIds.add(msg.messageId);
      if (active.seenMessageIds.size > 300) {
        const oldest = active.seenMessageIds.values().next().value;
        if (oldest) active.seenMessageIds.delete(oldest);
      }
    }
    if (active) active.totalChatMessages++;

    const roles = getChatterRoleFlags(msg, broadcasterTwitchId);
    publishOverlayEvent(userId, "chatMessage", {
      user: {
        name: msg.chatterName,
        avatar: null,
        color: msg.color || null,
        badges: {
          isMod: roles.isModerator,
          isVip: roles.isVip,
          isSub: roles.isSubscriber,
          isBroadcaster: roles.isBroadcaster,
        },
      },
      message: { text: msg.text, emotes: [] },
    });

    void getValidBotToken(userId).then((token) => {
      if (!token) return;
      void handleChatMessage(userId, broadcasterTwitchId, botTwitchId, token, msg);
    });
  };

  const timerTick = setInterval(() => {
    void runTimerTick(userId);
  }, TIMER_TICK_MS);

  const active: ActiveBot = {
    userId,
    client: null,
    rewardClient: null,
    rewardWebhook: false,
    onChatMessage,
    webhookInit: null,
    webhookWatch: null,
    seenMessageIds: new Set(),
    botTwitchId,
    broadcasterTwitchId,
    timerTick,
    startedAt: new Date(),
    totalChatMessages: 0,
    timerMessageBaseline: new Map(),
  };
  activeRef.current = active;
  activeBots.set(userId, active);

  const startSocketClient = () => {
    if (active.client) return;
    active.client = new ChatEventSubClient(
      broadcasterTwitchId,
      botTwitchId,
      () => getValidBotToken(userId),
      onChatMessage
    );
    active.client.connect();
  };

  if (!isWebhookTransportAvailable()) {
    startSocketClient();
    void ensureRewardListener(userId);
    return;
  }

  const runEnsure = async () => {
    if (activeBots.get(userId) !== active) return;
    try {
      const ok = await ensureChatWebhook(broadcasterTwitchId, botTwitchId);
      if (ok) {
        if (active.client) {
          const client = active.client;
          active.client = null;
          await client.disconnect();
        }
      } else {
        void logMissingScopes(userId).catch(() => {});
        startSocketClient();
      }
    } catch (err) {
      console.error("[bot] ошибка webhook-подписки, работаю через WebSocket:", err);
      startSocketClient();
    }
    await ensureRewardListener(userId).catch((err) => console.error("[rewards] ошибка подписки на награды:", err));
  };

  active.webhookInit = setTimeout(() => void runEnsure(), 5000);
  active.webhookWatch = setInterval(() => void runEnsure(), 5 * 60_000);
}

/**
 * Идемпотентно включает приём наград за баллы для запущенного бота: через
 * webhook, если сайт доступен по публичному https, иначе по WebSocket с
 * токеном стримера. Вызывается при старте бота, раз в 5 минут (вместе с
 * проверкой чат-подписки) и после создания награды в дашборде.
 */
export async function ensureRewardListener(userId: string) {
  const active = activeBots.get(userId);
  if (!active || active.rewardClient) return;
  if (!(await hasRewardScopes(userId))) return;

  if (isWebhookTransportAvailable() && (await ensureRedemptionWebhook(active.broadcasterTwitchId))) {
    active.rewardWebhook = true;
    return;
  }

  if (activeBots.get(userId) !== active || active.rewardClient) return;
  active.rewardClient = new EventSubSocketClient(
    "rewards",
    () => getValidBroadcasterToken(userId),
    [{ type: REDEMPTION_EVENT_TYPE, version: "1", condition: { broadcaster_user_id: active.broadcasterTwitchId } }],
    (type, event) => {
      if (type === REDEMPTION_EVENT_TYPE) {
        void handleRedemption(userId, active.botTwitchId, event as RedemptionEvent).catch((err) =>
          console.error("[rewards] ошибка обработки награды:", err)
        );
      }
    }
  );
  active.rewardClient.connect();
}

export function dispatchWebhookRedemption(event: RedemptionEvent) {
  for (const active of activeBots.values()) {
    if (active.broadcasterTwitchId === event.broadcaster_user_id) {
      void handleRedemption(active.userId, active.botTwitchId, event).catch((err) =>
        console.error("[rewards] ошибка обработки награды:", err)
      );
    }
  }
}

export function dispatchWebhookChat(event: ChatMessageEvent) {
  for (const active of activeBots.values()) {
    if (active.broadcasterTwitchId === event.broadcaster_user_id) {
      active.onChatMessage(toIncomingChatMessage(event));
    }
  }
}

export async function stopBotForUser(userId: string) {
  const active = activeBots.get(userId);
  if (!active) return;
  activeBots.delete(userId);
  if (active.timerTick) clearInterval(active.timerTick);
  if (active.webhookInit) clearTimeout(active.webhookInit);
  if (active.webhookWatch) clearInterval(active.webhookWatch);
  if (active.client) await active.client.disconnect();
  if (active.rewardClient) await active.rewardClient.disconnect();
  if (isWebhookTransportAvailable()) {
    await removeChatWebhook(active.broadcasterTwitchId, active.botTwitchId).catch(() => {});
  }
  if (active.rewardWebhook) await removeRedemptionWebhook(active.broadcasterTwitchId).catch(() => {});
}

export async function bootstrapEnabledBots() {
  const enabledBots = await prisma.botAccount.findMany({ where: { enabled: true } });
  for (const bot of enabledBots) {
    await startBotForUser(bot.userId);
  }
}
