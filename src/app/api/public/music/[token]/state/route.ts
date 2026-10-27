import { NextRequest, NextResponse } from "next/server";
import { getState } from "@/lib/music/queue";
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

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const userId = await resolveOverlayUserId(token);
  if (!userId) {
    return withCors(NextResponse.json({ error: "Unknown overlay token" }, { status: 404 }));
  }

  const state = await getState(userId);
  return withCors(NextResponse.json(state));
}
