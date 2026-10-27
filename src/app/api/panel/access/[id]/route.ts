import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ownerSession, OWNER_ONLY_ERROR } from "@/lib/panel";

type RouteParams = { params: Promise<{ id: string }> };

/** Отозвать доступ редактора. Он сразу вернётся в свою панель (см. getPanel). */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.panelAccess.deleteMany({ where: { id, ownerId: session.user.id } });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
