import { NextRequest, NextResponse } from "next/server";
import type { ViewerFieldType } from "@prisma/client";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";
import { VIEWER_KEY_RE, VIEWER_FIELD_TYPES, sanitizeAliases, seedViewerFields } from "@/lib/viewer-data";

export async function GET() {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await seedViewerFields(session.user.id);
  const fields = await prisma.viewerField.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? "").trim().toLowerCase();
  const label = String(body.label ?? "").trim().slice(0, 40);
  const type = VIEWER_FIELD_TYPES.includes(body.type) ? (body.type as ViewerFieldType) : "text";
  const aliases = sanitizeAliases(body.aliases);
  const maxLength = Math.min(200, Math.max(1, Number(body.maxLength) || 100));

  if (!VIEWER_KEY_RE.test(key)) {
    return NextResponse.json({ error: "Ключ — латиница, цифры и _, начинается с буквы (например city)" }, { status: 400 });
  }
  if (!label) return NextResponse.json({ error: "Укажите название поля" }, { status: 400 });
  const banned = checkBannedWords([key, label, aliases]);
  if (banned) return banned;

  try {
    const field = await prisma.viewerField.create({
      data: { userId: session.user.id, key, label, type, aliases, maxLength },
    });
    return NextResponse.json(field, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Поле с таким ключом уже есть" }, { status: 409 });
  }
}
