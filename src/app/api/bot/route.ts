import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { startBotForUser, stopBotForUser, isBotRunning } from "@/lib/bot/manager";

export async function GET() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bot = await prisma.botAccount.findUnique({ where: { userId: session.user.id } });
  if (!bot) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    botLogin: bot.botLogin,
    botDisplayName: bot.botDisplayName,
    enabled: bot.enabled,
    running: isBotRunning(session.user.id),
  });
}

/** Включить/выключить бота — доступно и редакторам панели. */
export async function PATCH(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bot = await prisma.botAccount.findUnique({ where: { userId: session.user.id } });
  if (!bot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const enabled = Boolean(body.enabled);

  await prisma.botAccount.update({ where: { userId: session.user.id }, data: { enabled } });

  if (enabled) {
    await startBotForUser(session.user.id);
  } else {
    await stopBotForUser(session.user.id);
  }

  return NextResponse.json({ enabled, running: isBotRunning(session.user.id) });
}

/** Отвязать бот-аккаунт — только владелец канала. */
export async function DELETE() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.panel.delegated) {
    return NextResponse.json({ error: "Отключить бота может только владелец канала" }, { status: 403 });
  }

  await stopBotForUser(session.user.id);
  await prisma.botAccount.deleteMany({ where: { userId: session.user.id } });

  return NextResponse.json({ ok: true });
}
