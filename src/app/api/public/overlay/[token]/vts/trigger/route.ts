import { NextRequest, NextResponse } from "next/server";
import { resolveVtsUserId } from "@/lib/overlay-token";
import { withCors, corsPreflight } from "@/lib/music/cors";
import { fireVtsTrigger } from "@/lib/bot/vts-fire";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ token: string }> };

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const userId = await resolveVtsUserId(token);
  if (!userId) {
    return withCors(NextResponse.json({ error: "Unknown overlay token" }, { status: 404 }));
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : undefined;
  const hotkeyId = typeof body.hotkeyId === "string" ? body.hotkeyId : undefined;

  const result = await fireVtsTrigger(userId, { name, hotkeyId });
  return withCors(NextResponse.json(result, { status: result.ok ? 200 : 400 }));
}
