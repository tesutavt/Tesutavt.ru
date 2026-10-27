import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PANEL_COOKIE } from "@/lib/panel";

/** Переключить панель: { ownerId } — чужая (нужен доступ), null — своя. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ownerId = typeof body.ownerId === "string" ? body.ownerId : null;
  const response = NextResponse.json({ ok: true });

  if (!ownerId || ownerId === session.user.id) {
    response.cookies.delete(PANEL_COOKIE);
    return response;
  }

  const access = await prisma.panelAccess.findUnique({
    where: { ownerId_editorTwitchId: { ownerId, editorTwitchId: session.user.twitchId } },
  });
  if (!access) return NextResponse.json({ error: "Нет доступа к этой панели" }, { status: 403 });

  response.cookies.set(PANEL_COOKIE, ownerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
