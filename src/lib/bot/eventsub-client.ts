import type { IncomingChatMessage } from "@/lib/bot/command-engine";

const EVENTSUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws";

interface TwitchBadge {
  set_id: string;
}

export interface ChatMessageEvent {
  broadcaster_user_id: string;
  message_id: string;
  chatter_user_id: string;
  chatter_user_login: string;
  chatter_user_name: string;
  message?: { text?: string };
  badges?: TwitchBadge[];
  color?: string;
}

export function toIncomingChatMessage(event: ChatMessageEvent): IncomingChatMessage {
  return {
    messageId: event.message_id,
    chatterId: event.chatter_user_id,
    chatterLogin: event.chatter_user_login,
    chatterName: event.chatter_user_name,
    text: event.message?.text ?? "",
    badgeSetIds: new Set((event.badges ?? []).map((b) => b.set_id)),
    color: event.color || null,
  };
}

export class ChatEventSubClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private subscriptionId: string | null = null;
  private closedByUser = false;
  private reconnectAttempt = 0;
  // Twitch мигрирует существующие подписки на новую сессию сама при
  // session_reconnect — если на этом флаге всё равно создать новую
  // подписку в обработчике session_welcome, получим ДВЕ активные
  // подписки на один и тот же чат, и бот будет отвечать на команды
  // дважды. Флаг отличает "это welcome после нашего initial connect"
  // от "это welcome после миграции по session_reconnect".
  private isReconnectMigration = false;

  constructor(
    private broadcasterTwitchId: string,
    private botTwitchId: string,
    private getBotToken: () => Promise<string | null>,
    private onChatMessage: (msg: IncomingChatMessage) => void
  ) {}

  connect(url: string = EVENTSUB_WS_URL) {
    this.closedByUser = false;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("message", (event) => {
      void this.handleMessage(String(event.data));
    });
    ws.addEventListener("close", () => this.handleClose());
    ws.addEventListener("error", () => {
      /* close event follows; reconnect handled there */
    });
  }

  async disconnect() {
    this.closedByUser = true;
    // Явно удаляем подписку в Twitch, а не полагаемся на то, что Twitch
    // сама заметит закрытие сокета — это происходит не мгновенно, и если
    // сразу же снова включить бота, старая подписка может ещё быть живой
    // одновременно с новой: оба сокета получат одно и то же сообщение чата,
    // и бот ответит на команду дважды.
    await this.deleteSubscription();
    this.ws?.close();
    this.ws = null;
    this.sessionId = null;
  }

  private async handleMessage(raw: string) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const metadata = data.metadata as Record<string, unknown> | undefined;
    const messageType = metadata?.message_type as string | undefined;
    const payload = data.payload as Record<string, unknown> | undefined;

    if (messageType === "session_welcome") {
      const session = payload?.session as { id: string } | undefined;
      if (!session) return;
      this.sessionId = session.id;
      this.reconnectAttempt = 0;

      if (this.isReconnectMigration) {
        // Существующая подписка (subscriptionId) сама переехала на новую
        // сессию вместе с соединением — пересоздавать её нельзя.
        this.isReconnectMigration = false;
        return;
      }
      await this.createSubscription();
    } else if (messageType === "session_reconnect") {
      const session = payload?.session as { reconnect_url: string } | undefined;
      if (!session) return;
      const oldWs = this.ws;
      this.isReconnectMigration = true;
      this.connect(session.reconnect_url);
      setTimeout(() => oldWs?.close(), 5000);
    } else if (messageType === "notification") {
      const subscriptionType = metadata?.subscription_type as string | undefined;
      if (subscriptionType === "channel.chat.message") {
        const event = payload?.event as ChatMessageEvent | undefined;
        if (event) this.emitChatMessage(event);
      }
    } else if (messageType === "revocation") {
      this.subscriptionId = null;
      void this.disconnect();
    }
  }

  private emitChatMessage(event: ChatMessageEvent) {
    this.onChatMessage(toIncomingChatMessage(event));
  }

  private async createSubscription() {
    const token = await this.getBotToken();
    if (!token || !this.sessionId) return;

    const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "channel.chat.message",
        version: "1",
        condition: {
          broadcaster_user_id: this.broadcasterTwitchId,
          user_id: this.botTwitchId,
        },
        transport: { method: "websocket", session_id: this.sessionId },
      }),
    });

    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { data?: { id: string }[] } | null;
      this.subscriptionId = body?.data?.[0]?.id ?? null;
    }
  }

  /** Best-effort: пусть даже сеть недоступна (например, только что моргнул VPN) — не блокируем реконнект. */
  private async deleteSubscription() {
    const subscriptionId = this.subscriptionId;
    this.subscriptionId = null;
    if (!subscriptionId) return;

    try {
      const token = await this.getBotToken();
      if (!token) return;
      await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID!,
        },
      });
    } catch {
      // Соединения может не быть (тот самый обрыв VPN) — Twitch сама
      // подчистит подписку по таймауту, когда заметит мёртвый сокет.
    }
  }

  private handleClose() {
    if (this.closedByUser) return;
    this.reconnectAttempt++;
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempt);
    // Обрыв без штатного session_reconnect (например, реальный обрыв сети) —
    // подписка на старую сессию не мигрирует сама, поэтому чистим её явно
    // перед тем как поднимать новое соединение и создавать новую.
    void this.deleteSubscription().finally(() => {
      setTimeout(() => this.connect(), delay);
    });
  }
}
