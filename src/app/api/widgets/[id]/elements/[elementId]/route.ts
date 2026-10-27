import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";

type RouteParams = { params: Promise<{ id: string; elementId: string }> };

const PATCHABLE_FIELDS = [
  "name",
  "x",
  "y",
  "width",
  "height",
  "zIndex",
  "html",
  "css",
  "js",
  "fieldsSchema",
  "fieldValues",
] as const;

async function getOwnedElement(elementId: string, widgetId: string, userId: string) {
  const element = await prisma.widgetElement.findUnique({
    where: { id: elementId },
    include: { widget: true },
  });
  if (!element || element.widgetId !== widgetId || element.widget.userId !== userId) {
    return null;
  }
  return element;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: widgetId, elementId } = await params;
  const existing = await getOwnedElement(elementId, widgetId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) data[field] = body[field];
  }
  // Видимый на стриме текст: название, HTML и значения полей (CSS/JS не проверяем).
  const banned = checkBannedWords([body.name, body.html, body.fieldValues]);
  if (banned) return banned;

  const element = await prisma.widgetElement.update({ where: { id: elementId }, data });
  return NextResponse.json(element);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: widgetId, elementId } = await params;
  const existing = await getOwnedElement(elementId, widgetId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.widgetElement.delete({ where: { id: elementId } });
  return NextResponse.json({ ok: true });
}
