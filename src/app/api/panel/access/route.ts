import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppAccessToken } from "@/lib/twitch-token";
import { ownerSession, OWNER_ONLY_ERROR } from "@/lib/panel";

interface HelixUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

function view(a: {
  id: string;
  editorLogin: string;
  editorDisplayName: string;
  editorAvatarUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    login: a.editorLogin,
    displayName: a.editorDisplayName,
    avatarUrl: a.editorAvatarUrl,
    createdAt: a.createdAt.toISOString(),
  };
}

/** Кому владелец выдал доступ к своей панели. */
export async function GET() {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await prisma.panelAccess.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(list.map(view));
}

/** Выдать доступ по нику Twitch: { login }. */
export async function POST(req: NextRequest) {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const login = String(body.login ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!/^[a-z0-9_]{3,25}$/.test(login)) {
    return NextResponse.json({ error: "Укажите ник Twitch, например moderator_name" }, { status: 400 });
  }

  const token = await getAppAccessToken();
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
    headers: { Authorization: `Bearer ${token}`, "Client-Id": process.env.TWITCH_CLIENT_ID! },
  });
  if (!res.ok) return NextResponse.json({ error: "Twitch сейчас не отвечает, попробуйте позже" }, { status: 502 });
  const user = ((await res.json()) as { data: HelixUser[] }).data[0];
  if (!user) return NextResponse.json({ error: `Пользователь «${login}» не найден на Twitch` }, { status: 404 });
  if (user.id === session.user.twitchId) {
    return NextResponse.json({ error: "Это ваш собственный аккаунт" }, { status: 400 });
  }

  const access = await prisma.panelAccess.upsert({
    where: { ownerId_editorTwitchId: { ownerId: session.user.id, editorTwitchId: user.id } },
    create: {
      ownerId: session.user.id,
      editorTwitchId: user.id,
      editorLogin: user.login,
      editorDisplayName: user.display_name,
      editorAvatarUrl: user.profile_image_url || null,
    },
    update: {
      editorLogin: user.login,
      editorDisplayName: user.display_name,
      editorAvatarUrl: user.profile_image_url || null,
    },
  });
  return NextResponse.json(view(access), { status: 201 });
}
