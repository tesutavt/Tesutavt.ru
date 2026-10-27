import { NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { skip } from "@/lib/music/queue";

export async function POST() {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const next = await skip(session.user.id);
  return NextResponse.json({ current: next });
}
