import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type RouteParams = { params: Promise<{ token: string }> };

interface SharedElement {
  name: string;
  kind: "preset" | "custom";
  presetId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  html: string;
  css: string;
  js: string;
  fieldsSchema: unknown;
  fieldValues: unknown;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  const share = await prisma.widgetShare.findUnique({ where: { token } });
  if (!share) {
    return NextResponse.json({ error: "Ссылка недействительна" }, { status: 404 });
  }

  const elements = (share.elements as unknown as SharedElement[]) ?? [];

  const widget = await prisma.widget.create({
    data: {
      userId: session.user.id,
      name: share.name,
      canvasWidth: share.canvasWidth,
      canvasHeight: share.canvasHeight,
      elements: {
        create: elements.map((el) => ({
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
          fieldsSchema: el.fieldsSchema as Prisma.InputJsonValue,
          fieldValues: el.fieldValues as Prisma.InputJsonValue,
        })),
      },
    },
  });

  return NextResponse.json({ widgetId: widget.id }, { status: 201 });
}
