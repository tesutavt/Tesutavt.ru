import { NextRequest, NextResponse } from "next/server";
import type { ViewerFieldType } from "@prisma/client";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";
import { VIEWER_FIELD_TYPES, sanitizeAliases } from "@/lib/viewer-data";

type RouteParams = { params: Promise<{ id: string }> };

async function ownedField(id: string, userId: string) {
  const field = await prisma.viewerField.findUnique({ where: { id } });
  return field && field.userId === userId ? field : null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await ownedField(id, session.user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { label?: string; type?: ViewerFieldType; aliases?: string[]; maxLength?: number; enabled?: boolean } = {};
  if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim().slice(0, 40);
  if (VIEWER_FIELD_TYPES.includes(body.type)) data.type = body.type;
  if ("aliases" in body) data.aliases = sanitizeAliases(body.aliases);
  if (Number.isFinite(body.maxLength)) data.maxLength = Math.min(200, Math.max(1, Math.round(body.maxLength)));
  if ("enabled" in body) data.enabled = Boolean(body.enabled);

  const banned = checkBannedWords([data.label, data.aliases]);
  if (banned) return banned;

  const field = await prisma.viewerField.update({ where: { id }, data });
  return NextResponse.json(field);
}

/** Удаляет поле вместе со всеми сохранёнными значениями зрителей. */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const field = await ownedField(id, session.user.id);
  if (!field) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.viewerData.deleteMany({ where: { userId: session.user.id, key: field.key } }),
    prisma.viewerField.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
