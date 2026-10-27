import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPanel } from "@/lib/panel";

const BOT_SCOPES = "user:read:chat user:write:chat user:bot";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL));
  }
  // Бот привязывается к аккаунту, под которым вошли (см. callback) — в чужой
  // панели это был бы аккаунт редактора, а не владельца.
  if ((await getPanel())?.delegated) {
    return NextResponse.redirect(new URL("/dashboard/bot", process.env.NEXTAUTH_URL));
  }

  const state = randomBytes(16).toString("hex");
  // req.url за nginx-прокси показывает внутренний http://localhost:3000, а
  // не настоящий публичный https-домен - Twitch на такой redirect_uri
  // ругается. NEXTAUTH_URL - единственный надёжный источник публичного адреса.
  const redirectUri = new URL("/api/bot/callback", process.env.NEXTAUTH_URL).toString();

  const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.TWITCH_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", BOT_SCOPES);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("force_verify", "true");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("bot_oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    path: "/api/bot",
    sameSite: "lax",
  });
  return response;
}
