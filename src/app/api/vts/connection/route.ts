import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { publishOverlayEvent } from "@/lib/bot/event-bus";

export const dynamic = "force-dynamic";

function serialize(connection: {
  port: number;
  hotkeys: unknown;
  bridgeToken: string;
  bridgeStatus: string | null;
  lastSeenAt: Date | null;
  authToken: string | null;
}) {
  return {
    port: connection.port,
    hotkeys: connection.hotkeys ?? [],
    bridgeToken: connection.bridgeToken,
    bridgeStatus: connection.bridgeStatus,
    lastSeenAt: connection.lastSeenAt?.toISOString() ?? null,
    authorized: Boolean(connection.authToken),
  };
}

export async function GET() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.vtsConnection.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  });
  return NextResponse.json(serialize(connection));
}

/** port — порт API VTube Studio; resetAuth — забыть токен (VTS спросит
 * разрешение заново); refreshHotkeys — попросить мост перечитать хоткеи. */
export async function PATCH(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const data: { port?: number; authToken?: null } = {};
  if (Number.isFinite(body.port) && body.port > 0 && body.port < 65536) data.port = Math.round(body.port);
  if (body.resetAuth === true) data.authToken = null;

  const connection = await prisma.vtsConnection.upsert({
    where: { userId },
    create: { userId, port: data.port ?? 8001 },
    update: data,
  });

  // Мост перечитывает настройки (порт/токен) при переподключении, а
  // хоткеи — по этому событию.
  if (data.port !== undefined || data.authToken !== undefined) publishOverlayEvent(userId, "vtsReconnect", {});
  if (body.refreshHotkeys === true) publishOverlayEvent(userId, "vtsRefreshHotkeys", {});

  return NextResponse.json(serialize(connection));
}
