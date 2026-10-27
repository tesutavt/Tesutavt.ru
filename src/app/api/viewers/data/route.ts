import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

/** Сохранённые данные зрителей канала; ?q= — поиск по нику. */
export async function GET(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase().replace(/^@/, "") ?? "";
  const rows = await prisma.viewerData.findMany({
    where: { userId: session.user.id, ...(q ? { viewerLogin: { contains: q } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: PAGE_SIZE,
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      viewerLogin: r.viewerLogin,
      viewerName: r.viewerName,
      key: r.key,
      value: r.value,
      updatedAt: r.updatedAt.toISOString(),
    }))
  );
}

/** Удалить все данные одного зрителя: ?login=nickname. */
export async function DELETE(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const login = req.nextUrl.searchParams.get("login")?.trim().toLowerCase().replace(/^@/, "");
  if (!login) return NextResponse.json({ error: "login is required" }, { status: 400 });
  const { count } = await prisma.viewerData.deleteMany({ where: { userId: session.user.id, viewerLogin: login } });
  return NextResponse.json({ ok: true, count });
}
