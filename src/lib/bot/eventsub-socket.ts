const EVENTSUB_WS_URL = "wss://eventsub.wss.twitch.tv/ws";

export interface EventSubSubscriptionSpec {
  type: string;
  version: string;
  condition: Record<string, string>;
}

/**
 * Универсальный EventSub-клиент по WebSocket для подписок, которые
 * создаются токеном СТРИМЕРА (награды за баллы и т.п.) — в отличие от
 * ChatEventSubClient, который работает от имени бота. Та же логика
 * reconnect/миграции сессии, что и там (см. комментарии в eventsub-client.ts).
 */
export class EventSubSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private subscriptionIds: string[] = [];
  private closedByUser = false;
  private reconnectAttempt = 0;
  private isReconnectMigration = false;

  constructor(
    private label: string,
    private getToken: () => Promise<string | null>,
    private subscriptions: EventSubSubscriptionSpec[],
    private onEvent: (type: string, event: unknown) => void
  ) {}

  connect(url: string = EVENTSUB_WS_URL) {
    this.closedByUser = false;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.addEventListener("message", (event) => void this.handleMessage(String(event.data)));
    ws.addEventListener("close", () => {
      if (this.ws === ws) this.handleClose();
    });
    ws.addEventListener("error", () => {
      /* close event follows; reconnect handled there */
    });
  }

  async disconnect() {
    this.closedByUser = true;
    await this.deleteSubscriptions();
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
        this.isReconnectMigration = false;
        return;
      }
      await this.createSubscriptions();
    } else if (messageType === "session_reconnect") {
      const session = payload?.session as { reconnect_url: string } | undefined;
      if (!session) return;
      const oldWs = this.ws;
      this.isReconnectMigration = true;
      this.connect(session.reconnect_url);
      setTimeout(() => oldWs?.close(), 5000);
    } else if (messageType === "notification") {
      const type = metadata?.subscription_type as string | undefined;
      if (type && payload?.event) this.onEvent(type, payload.event);
    } else if (messageType === "revocation") {
      console.warn(`[${this.label}] Twitch отозвал подписку EventSub`);
    }
  }

  private async createSubscriptions() {
    const token = await this.getToken();
    if (!token || !this.sessionId) return;
    for (const spec of this.subscriptions) {
      const res = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...spec, transport: { method: "websocket", session_id: this.sessionId } }),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { data?: { id: string }[] } | null;
        const id = body?.data?.[0]?.id;
        if (id) this.subscriptionIds.push(id);
      } else {
        console.error(`[${this.label}] не удалось подписаться на ${spec.type}:`, res.status, await res.text());
      }
    }
  }

  /** Best-effort: если сети нет, Twitch сама подчистит подписки мёртвой сессии. */
  private async deleteSubscriptions() {
    const ids = this.subscriptionIds;
    this.subscriptionIds = [];
    if (!ids.length) return;
    try {
      const token = await this.getToken();
      if (!token) return;
      for (const id of ids) {
        await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}`, "Client-Id": process.env.TWITCH_CLIENT_ID! },
        });
      }
    } catch {
      // см. комментарий к методу
    }
  }

  private handleClose() {
    if (this.closedByUser) return;
    this.reconnectAttempt++;
    const delay = Math.min(30_000, 1000 * 2 ** this.reconnectAttempt);
    void this.deleteSubscriptions().finally(() => setTimeout(() => this.connect(), delay));
  }
}
