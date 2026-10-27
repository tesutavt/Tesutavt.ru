import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { getState } from "@/lib/music/queue";
import { requestSong } from "@/lib/music/request-handler";

// auth() уже задействует cookies() (сессия), что само по себе исключает
// статический кэш — но помечаем явно, раз этот роут опрашивается
// дашбордом каждые несколько секунд (см. MusicQueueSection.tsx).
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getState(session.user.id);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}

export async function POST(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const query: string = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const result = await requestSong(session.user.id, query, {
    requestedBy: session.user.displayName || session.user.login,
    requestSource: "manual",
  });

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error ?? "Ничего не найдено", reason: result.reason }, { status });
  }

  return NextResponse.json({ tracks: result.tracks, track: result.track }, { status: 201 });
}
