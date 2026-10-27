import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveVtsUserId } from "@/lib/overlay-token";
import { withCors, corsPreflight } from "@/lib/music/cors";

// Опрашивается/используется мостом VTube Studio (страница /vts/[token] или
// tools/vts-relay.js); см. комментарий в остальных публичных роутах про
// кэширование GET по [token]. [token] — bridgeToken или overlayToken.
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ token: string }> };

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const userId = await resolveVtsUserId(token);
  if (!userId) {
    return withCors(NextResponse.json({ error: "Unknown overlay token" }, { status: 404 }));
  }

  const connection = await prisma.vtsConnection.findUnique({ where: { userId } });
  return withCors(
    NextResponse.json({ port: connection?.port ?? 8001, authToken: connection?.authToken ?? null })
  );
}

/** Мост сохраняет сюда токен, список хоткеев и свой статус, полученные от
 * VTS — чтобы не спрашивать разрешение заново и чтобы дашборд мог
 * показывать хоткеи и состояние, сам к VTS не подключаясь. Любой POST
 * заодно служит heartbeat'ом (lastSeenAt). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const userId = await resolveVtsUserId(token);
  if (!userId) {
    return withCors(NextResponse.json({ error: "Unknown overlay token" }, { status: 404 }));
  }

  const body = await req.json().catch(() => ({}));
  const data: { authToken?: string | null; hotkeys?: never; bridgeStatus?: string; lastSeenAt: Date } = {
    lastSeenAt: new Date(),
  };
  if (typeof body.authToken === "string" || body.authToken === null) data.authToken = body.authToken;
  if (Array.isArray(body.hotkeys)) data.hotkeys = body.hotkeys as never;
  if (typeof body.status === "string") data.bridgeStatus = body.status.slice(0, 200);

  await prisma.vtsConnection.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return withCors(NextResponse.json({ ok: true }));
}
