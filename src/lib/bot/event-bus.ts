interface QueuedEvent {
  seq: number;
  type: string;
  data: unknown;
}

interface UserQueue {
  events: QueuedEvent[];
  nextSeq: number;
}

// Сколько последних событий держим на пользователя — виджет опрашивает
// раз в ~1.5с, этого с большим запасом хватает, чтобь ничего не потерять
// между опросами, и не даёт очереди расти бесконечно, если виджет не открыт.
const MAX_BUFFERED = 50;

// Next.js dev-сервер (особенно с Turbopack) может пересоздать модуль
// отдельно для разных route handler'ов при hot reload — тогда у роута
// опроса и у lib/bot/manager.ts оказываются РАЗНЫЕ экземпляры этого модуля
// с разными Map. Тот же приём, что уже используется для PrismaClient в
// lib/prisma.ts — вешаем Map на globalThis, который переживает
// пересоздание модуля в рамках одного Node-процесса.
const globalForEventBus = globalThis as unknown as {
  __vtubeOverlayQueues: Map<string, UserQueue> | undefined;
};

const queues = globalForEventBus.__vtubeOverlayQueues ?? new Map<string, UserQueue>();
globalForEventBus.__vtubeOverlayQueues = queues;

/**
 * Живая доставка серверных событий (сейчас — chatMessage от бота, см.
 * lib/bot/manager.ts) в виджеты на реальной странице оверлея.
 *
 * Раньше это было SSE (push), но так и не удалось надёжно поймать, почему
 * события не доходили до браузера в dev-режиме — вместо дальнейшей отладки
 * вслепую заменено на простой поллинг (GET .../events?since=N), тем же
 * механизмом, что уже проверенно работает у музыкального виджета.
 */
export function publishOverlayEvent(userId: string, type: string, data: unknown): void {
  let queue = queues.get(userId);
  if (!queue) {
    queue = { events: [], nextSeq: 1 };
    queues.set(userId, queue);
  }
  queue.events.push({ seq: queue.nextSeq, type, data });
  queue.nextSeq++;
  if (queue.events.length > MAX_BUFFERED) {
    queue.events.splice(0, queue.events.length - MAX_BUFFERED);
  }
}

export function getOverlayEventsSince(
  userId: string,
  sinceSeq: number
): { events: QueuedEvent[]; latestSeq: number } {
  const queue = queues.get(userId);
  if (!queue) return { events: [], latestSeq: sinceSeq };
  return {
    events: queue.events.filter((e) => e.seq > sinceSeq),
    latestSeq: queue.nextSeq - 1,
  };
}
