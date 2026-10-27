import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";

export async function GET() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const widgets = await prisma.widget.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { elements: true } } },
  });

  return NextResponse.json(widgets);
}

export async function POST(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name: string = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Новый виджет";
  const banned = checkBannedWords(name);
  if (banned) return banned;

  const widget = await prisma.widget.create({
    data: {
      userId: session.user.id,
      name,
    },
  });

  return NextResponse.json(widget, { status: 201 });
}
