import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const triggers = await prisma.vtsTrigger.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(triggers);
}

export async function POST(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
  const hotkeyId = typeof body.hotkeyId === "string" ? body.hotkeyId : "";
  const hotkeyLabel = typeof body.hotkeyLabel === "string" ? body.hotkeyLabel : "";

  if (!name || !/^[a-z0-9_-]+$/.test(name)) {
    return NextResponse.json(
      { error: "Название триггера — латиница/цифры/дефис/подчёркивание, без пробелов" },
      { status: 400 }
    );
  }
  const banned = checkBannedWords(name);
  if (banned) return banned;
  if (!hotkeyId) {
    return NextResponse.json({ error: "Не выбран хоткей" }, { status: 400 });
  }

  try {
    const trigger = await prisma.vtsTrigger.create({
      data: { userId: session.user.id, name, hotkeyId, hotkeyLabel },
    });
    return NextResponse.json(trigger, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Триггер с таким именем уже есть" }, { status: 409 });
  }
}
