import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";

type RouteParams = { params: Promise<{ id: string }> };

const PATCHABLE_FIELDS = ["response", "mode", "graph", "userLevel", "cooldownSeconds", "enabled"] as const;

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.botCommand.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) data[field] = body[field];
  }

  // В графе проверяем только содержимое блоков (тексты, url, код) — не
  // служебные id/координаты, где случайные символы могли бы дать ложное срабатывание.
  const graphNodes = (body.graph as { nodes?: { data?: unknown }[] } | undefined)?.nodes ?? [];
  const banned = checkBannedWords([body.response, graphNodes.map((n) => n.data)]);
  if (banned) return banned;

  const command = await prisma.botCommand.update({ where: { id }, data });
  return NextResponse.json(command);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.botCommand.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.standardKey) {
    return NextResponse.json(
      { error: "Стандартную команду нельзя удалить, только отключить" },
      { status: 400 }
    );
  }

  await prisma.botCommand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
