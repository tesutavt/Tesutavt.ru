import { NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { clear } from "@/lib/music/queue";

export async function POST() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clear(session.user.id);
  return NextResponse.json({ ok: true });
}
