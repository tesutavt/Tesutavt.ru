import { NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/bot/eventsub-webhook";
import { dispatchWebhookChat, dispatchWebhookRedemption } from "@/lib/bot/manager";
import type { ChatMessageEvent } from "@/lib/bot/eventsub-client";
import { REDEMPTION_EVENT_TYPE, type RedemptionEvent } from "@/lib/rewards/redemption-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_AGE_MS = 10 * 60_000;
const seen = new Map<string, number>();

function alreadySeen(id: string) {
  const now = Date.now();
  for (const [key, at] of seen) if (now - at > MAX_AGE_MS) seen.delete(key);
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

export async function POST(req: NextRequest) {
  const id = req.headers.get("twitch-eventsub-message-id") ?? "";
  const timestamp = req.headers.get("twitch-eventsub-message-timestamp") ?? "";
  const signature = req.headers.get("twitch-eventsub-message-signature") ?? "";
  const type = req.headers.get("twitch-eventsub-message-type") ?? "";
  const raw = await req.text();

  if (!id || !timestamp || !signature || !verifyWebhookSignature(id, timestamp, raw, signature)) {
    return new Response("invalid signature", { status: 403 });
  }
  if (Math.abs(Date.now() - Date.parse(timestamp)) > MAX_AGE_MS) {
    return new Response("stale", { status: 403 });
  }

  const body = JSON.parse(raw);

  if (type === "webhook_callback_verification") {
    return new Response(body.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  if (alreadySeen(id)) return new Response(null, { status: 204 });

  if (type === "notification" && body.subscription?.type === "channel.chat.message") {
    dispatchWebhookChat(body.event as ChatMessageEvent);
  } else if (type === "notification" && body.subscription?.type === REDEMPTION_EVENT_TYPE) {
    dispatchWebhookRedemption(body.event as RedemptionEvent);
  } else if (type === "revocation") {
    console.warn("[bot] Twitch отозвал подписку:", body.subscription?.status);
  }

  return new Response(null, { status: 204 });
}
