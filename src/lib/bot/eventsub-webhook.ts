import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppAccessToken } from "@/lib/twitch-token";

const HELIX_SUBSCRIPTIONS = "https://api.twitch.tv/helix/eventsub/subscriptions";

interface SubscriptionInfo {
  id: string;
  status: string;
  condition: { broadcaster_user_id: string; user_id?: string };
  transport: { method: string; callback?: string };
}

export function isWebhookTransportAvailable() {
  const raw = process.env.NEXTAUTH_URL;
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "localhost" || url.hostname.endsWith(".local")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function webhookSecret() {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update("vtube-eventsub").digest("hex");
}

function webhookCallbackUrl() {
  const url = new URL("/api/twitch/eventsub", process.env.NEXTAUTH_URL);
  url.searchParams.set("k", webhookSecret().slice(0, 8));
  return url.toString();
}

export function verifyWebhookSignature(id: string, timestamp: string, rawBody: string, signature: string) {
  const expected = "sha256=" + createHmac("sha256", webhookSecret()).update(id + timestamp + rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function helixHeaders() {
  const token = await getAppAccessToken();
  return { Authorization: `Bearer ${token}`, "Client-Id": process.env.TWITCH_CLIENT_ID! };
}

async function listChatSubscriptions(broadcasterTwitchId: string, botTwitchId: string) {
  const headers = await helixHeaders();
  const res = await fetch(`${HELIX_SUBSCRIPTIONS}?type=channel.chat.message&user_id=${botTwitchId}`, { headers });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: SubscriptionInfo[] };
  return body.data.filter(
    (s) => s.condition.broadcaster_user_id === broadcasterTwitchId && s.condition.user_id === botTwitchId
  );
}

async function deleteSubscription(id: string) {
  const headers = await helixHeaders();
  await fetch(`${HELIX_SUBSCRIPTIONS}?id=${id}`, { method: "DELETE", headers });
}

export async function ensureChatWebhook(broadcasterTwitchId: string, botTwitchId: string): Promise<boolean> {
  const callback = webhookCallbackUrl();
  const existing = await listChatSubscriptions(broadcasterTwitchId, botTwitchId);

  let healthy = false;
  for (const sub of existing) {
    const usable =
      sub.transport.method === "webhook" &&
      sub.transport.callback === callback &&
      (sub.status === "enabled" || sub.status === "webhook_callback_verification_pending");
    if (usable && !healthy) {
      healthy = true;
    } else {
      await deleteSubscription(sub.id);
    }
  }
  if (healthy) return true;

  const headers = await helixHeaders();
  const res = await fetch(HELIX_SUBSCRIPTIONS, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: { broadcaster_user_id: broadcasterTwitchId, user_id: botTwitchId },
      transport: { method: "webhook", callback, secret: webhookSecret() },
    }),
  });

  if (res.ok || res.status === 409) return true;
  console.error("[bot] не удалось создать webhook-подписку на чат:", res.status, await res.text());
  return false;
}

export async function removeChatWebhook(broadcasterTwitchId: string, botTwitchId: string) {
  const existing = await listChatSubscriptions(broadcasterTwitchId, botTwitchId);
  for (const sub of existing) await deleteSubscription(sub.id);
}

// --- Награды за баллы: подписка от имени приложения (app token). Twitch
// принимает её, только если стример выдал приложению channel:read:redemptions
// (см. REWARD_SCOPES в lib/rewards/twitch-rewards.ts).

const REDEMPTION_TYPE = "channel.channel_points_custom_reward_redemption.add";

async function listRedemptionSubscriptions(broadcasterTwitchId: string) {
  const headers = await helixHeaders();
  const res = await fetch(`${HELIX_SUBSCRIPTIONS}?type=${REDEMPTION_TYPE}&user_id=${broadcasterTwitchId}`, { headers });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: SubscriptionInfo[] };
  return body.data.filter((s) => s.condition.broadcaster_user_id === broadcasterTwitchId);
}

export async function ensureRedemptionWebhook(broadcasterTwitchId: string): Promise<boolean> {
  const callback = webhookCallbackUrl();
  let healthy = false;
  for (const sub of await listRedemptionSubscriptions(broadcasterTwitchId)) {
    const usable =
      sub.transport.method === "webhook" &&
      sub.transport.callback === callback &&
      (sub.status === "enabled" || sub.status === "webhook_callback_verification_pending");
    if (usable && !healthy) healthy = true;
    else await deleteSubscription(sub.id);
  }
  if (healthy) return true;

  const headers = await helixHeaders();
  const res = await fetch(HELIX_SUBSCRIPTIONS, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: REDEMPTION_TYPE,
      version: "1",
      condition: { broadcaster_user_id: broadcasterTwitchId },
      transport: { method: "webhook", callback, secret: webhookSecret() },
    }),
  });
  if (res.ok || res.status === 409) return true;
  console.error("[rewards] не удалось создать webhook-подписку на награды:", res.status, await res.text());
  return false;
}

export async function removeRedemptionWebhook(broadcasterTwitchId: string) {
  for (const sub of await listRedemptionSubscriptions(broadcasterTwitchId)) await deleteSubscription(sub.id);
}
