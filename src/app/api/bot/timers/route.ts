import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";

function sanitizeMessages(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [];
  return raw.map((m) => String(m).trim()).filter(Boolean);
}

export async function GET() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const timers = await prisma.botTimer.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(timers);
}

export async function POST(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  // Поддерживаем и messages: string[] (новый формат), и старый одиночный
  // message: string — на случай, если что-то ещё шлёт старую форму.
  const messages = sanitizeMessages(body.messages ?? (typeof body.message === "string" ? [body.message] : []));
  const banned = checkBannedWords(messages);
  if (banned) return banned;
  if (!messages.length) {
    return NextResponse.json({ error: "Нужен хотя бы один текст сообщения" }, { status: 400 });
  }
  const intervalSeconds: number = Number.isFinite(body.intervalSeconds) ? body.intervalSeconds : 600;
  const minMessages: number = Number.isFinite(body.minMessages) ? Math.max(0, Math.round(body.minMessages)) : 0;

  const timer = await prisma.botTimer.create({
    data: { userId: session.user.id, messages, intervalSeconds, minMessages },
  });

  return NextResponse.json(timer, { status: 201 });
}
