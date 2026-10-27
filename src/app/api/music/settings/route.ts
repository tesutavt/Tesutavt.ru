import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { getSettings, setVolume } from "@/lib/music/queue";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings(session.user.id);
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (typeof body.volume === "number") {
    await setVolume(session.user.id, body.volume);
  }

  if (typeof body.maxQueueLength === "number" && body.maxQueueLength >= 1 && body.maxQueueLength <= 200) {
    await prisma.musicSettings.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, maxQueueLength: Math.round(body.maxQueueLength) },
      update: { maxQueueLength: Math.round(body.maxQueueLength) },
    });
  }

  const settings = await getSettings(session.user.id);
  return NextResponse.json(settings);
}
