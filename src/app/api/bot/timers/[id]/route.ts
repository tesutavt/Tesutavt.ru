import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.botTimer.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if ("messages" in body) {
    const messages = Array.isArray(body.messages)
      ? body.messages.map((m: unknown) => String(m).trim()).filter(Boolean)
      : [];
    const banned = checkBannedWords(messages);
    if (banned) return banned;
    data.messages = messages;
  }
  if ("intervalSeconds" in body && Number.isFinite(body.intervalSeconds)) {
    data.intervalSeconds = body.intervalSeconds;
  }
  if ("minMessages" in body && Number.isFinite(body.minMessages)) {
    data.minMessages = Math.max(0, Math.round(body.minMessages));
  }
  if ("enabled" in body) {
    data.enabled = Boolean(body.enabled);
  }

  const timer = await prisma.botTimer.update({ where: { id }, data });
  return NextResponse.json(timer);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.botTimer.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.botTimer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
