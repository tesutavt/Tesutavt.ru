import { NextRequest, NextResponse } from "next/server";
import { ownerSession, OWNER_ONLY_ERROR } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { fetchYandexUid } from "@/lib/music/yandex-client";

export async function GET() {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.yandexAccount.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json({ connected: Boolean(account), uid: account?.uid ?? null });
}

export async function POST(req: NextRequest) {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const accessToken: string = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!accessToken) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }

  let uid: number;
  try {
    uid = await fetchYandexUid(accessToken);
  } catch {
    return NextResponse.json({ error: "Токен недействителен или Яндекс.Музыка недоступна" }, { status: 400 });
  }

  await prisma.yandexAccount.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, accessToken, uid },
    update: { accessToken, uid },
  });

  return NextResponse.json({ connected: true, uid });
}

export async function DELETE() {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.yandexAccount.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
