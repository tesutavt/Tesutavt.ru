import { NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { getValidBroadcasterToken } from "@/lib/twitch-token";

export async function POST() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [bot, user] = await Promise.all([
    prisma.botAccount.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);
  if (!bot || !user) {
    return NextResponse.json({ error: "Bot not connected" }, { status: 404 });
  }

  const token = await getValidBroadcasterToken(session.user.id);
  if (!token) {
    return NextResponse.json({ error: "No broadcaster token" }, { status: 400 });
  }

  const url = new URL("https://api.twitch.tv/helix/moderation/moderators");
  url.searchParams.set("broadcaster_id", user.twitchId);
  url.searchParams.set("user_id", bot.botTwitchId);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Twitch API error: ${text}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
