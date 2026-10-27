import { NextRequest, NextResponse } from "next/server";
import { onTrackEnded } from "@/lib/music/queue";
import { resolveOverlayUserId } from "@/lib/overlay-token";
import { withCors, corsPreflight } from "@/lib/music/cors";

// Постоянно опрашивается виджетами; без этого Next.js может закэшировать
// GET-ответ по [token] и отдавать один и тот же устаревший снимок вместо
// актуального состояния.
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ token: string }> };

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const userId = await resolveOverlayUserId(token);
  if (!userId) {
    return withCors(NextResponse.json({ error: "Unknown overlay token" }, { status: 404 }));
  }

  const body = await req.json().catch(() => ({}));
  const trackId = typeof body.trackId === "string" ? body.trackId : null;

  const next = await onTrackEnded(userId, trackId);
  return withCors(NextResponse.json({ current: next }));
}
