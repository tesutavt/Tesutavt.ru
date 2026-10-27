import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";
import type { CommandUserLevel } from "@prisma/client";

export async function GET() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commands = await prisma.botCommand.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(commands);
}

export async function POST(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  let trigger: string = typeof body.trigger === "string" ? body.trigger.trim().toLowerCase() : "";
  if (!trigger) {
    return NextResponse.json({ error: "Trigger is required" }, { status: 400 });
  }
  if (!trigger.startsWith("!")) trigger = `!${trigger}`;

  const response: string = typeof body.response === "string" ? body.response : "";
  const banned = checkBannedWords([trigger, response]);
  if (banned) return banned;
  const userLevel: CommandUserLevel = body.userLevel ?? "everyone";
  const cooldownSeconds: number = Number.isFinite(body.cooldownSeconds) ? body.cooldownSeconds : 5;

  try {
    const command = await prisma.botCommand.create({
      data: {
        userId: session.user.id,
        trigger,
        response,
        userLevel,
        cooldownSeconds,
      },
    });
    return NextResponse.json(command, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Команда с таким триггером уже существует" }, { status: 409 });
  }
}
