import { NextRequest, NextResponse } from "next/server";
import { resolveVtsUserId } from "@/lib/overlay-token";
import { getOverlayEventsSince } from "@/lib/bot/event-bus";
import { withCors, corsPreflight } from "@/lib/music/cors";

// Постоянно опрашивается виджетами; без этого Next.js может закэшировать
// GET-ответ по [token] и отдавать один и тот же устаревший снимок вместо
// актуального состояния.
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ token: string }> };

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const userId = await resolveVtsUserId(token);
  if (!userId) {
    return withCors(NextResponse.json({ error: "Unknown overlay token" }, { status: 404 }));
  }

  const since = Number(req.nextUrl.searchParams.get("since") ?? "0") || 0;
  const { events, latestSeq } = getOverlayEventsSince(userId, since);

  return withCors(NextResponse.json({ events, latestSeq }));
}
