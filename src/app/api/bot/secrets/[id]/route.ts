import { NextRequest, NextResponse } from "next/server";
import { ownerSession, OWNER_ONLY_ERROR } from "@/lib/panel";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { count } = await prisma.botSecret.deleteMany({ where: { id, userId: session.user.id } });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
