import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const widget = await prisma.widget.findUnique({
    where: { id },
    include: { elements: { orderBy: { createdAt: "asc" } } },
  });

  if (!widget || widget.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Снимок, а не живая ссылка на оригинал: дальнейшие правки в исходном
  // виджете не должны задним числом менять то, что уже показано получателю
  // на экране подтверждения, и ссылка продолжает работать, даже если
  // исходный виджет потом удалят.
  const share = await prisma.widgetShare.create({
    data: {
      name: widget.name,
      canvasWidth: widget.canvasWidth,
      canvasHeight: widget.canvasHeight,
      sourceUserId: session.user.id,
      elements: widget.elements.map((el) => ({
        name: el.name,
        kind: el.kind,
        presetId: el.presetId,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        zIndex: el.zIndex,
        html: el.html,
        css: el.css,
        js: el.js,
        fieldsSchema: el.fieldsSchema,
        fieldValues: el.fieldValues,
      })),
    },
  });

  return NextResponse.json({ token: share.token }, { status: 201 });
}
