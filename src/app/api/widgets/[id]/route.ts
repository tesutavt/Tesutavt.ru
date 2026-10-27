import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const widget = await prisma.widget.findUnique({
    where: { id },
    include: { elements: { orderBy: { createdAt: "asc" } } },
  });

  if (!widget || widget.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(widget);
}

const PATCHABLE_FIELDS = ["name", "canvasWidth", "canvasHeight"] as const;

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.widget.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) data[field] = body[field];
  }
  const banned = checkBannedWords(body.name);
  if (banned) return banned;

  const widget = await prisma.widget.update({ where: { id }, data });
  return NextResponse.json(widget);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.widget.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.widget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
