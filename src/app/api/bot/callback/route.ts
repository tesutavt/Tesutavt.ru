import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedStandardCommands } from "@/lib/bot/standard-commands";

interface TwitchHelixUser {
  id: string;
  login: string;
  display_name: string;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = req.cookies.get("bot_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/dashboard/bot?error=state", process.env.NEXTAUTH_URL));
  }

  // Должен быть БУКВАЛЬНО тем же значением, что улетало в /api/bot/connect -
  // Twitch сверяет redirect_uri при обмене code на токен. req.url здесь не
  // годится по той же причине (за прокси показывает localhost:3000).
  const redirectUri = new URL("/api/bot/callback", process.env.NEXTAUTH_URL).toString();

  const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/dashboard/bot?error=token", process.env.NEXTAUTH_URL));
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const userRes = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
    },
  });
  if (!userRes.ok) {
    return NextResponse.redirect(new URL("/dashboard/bot?error=profile", process.env.NEXTAUTH_URL));
  }
  const { data } = (await userRes.json()) as { data: TwitchHelixUser[] };
  const botUser = data[0];

  await prisma.botAccount.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      botTwitchId: botUser.id,
      botLogin: botUser.login,
      botDisplayName: botUser.display_name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      botTwitchId: botUser.id,
      botLogin: botUser.login,
      botDisplayName: botUser.display_name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  await seedStandardCommands(session.user.id);

  const response = NextResponse.redirect(new URL("/dashboard/bot", process.env.NEXTAUTH_URL));
  response.cookies.delete("bot_oauth_state");
  return response;
}
