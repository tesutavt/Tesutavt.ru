import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { getPresetById } from "@/lib/widget-presets";
import { defaultFieldValues } from "@/lib/widget-types";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: widgetId } = await params;
  const widget = await prisma.widget.findUnique({
    where: { id: widgetId },
    include: { _count: { select: { elements: true } } },
  });
  if (!widget || widget.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const presetId: string | undefined = body.presetId;
  const preset = presetId ? getPresetById(presetId) : undefined;
  if (presetId && !preset) {
    return NextResponse.json({ error: "Unknown preset" }, { status: 400 });
  }

  const offset = (widget._count.elements % 10) * 24;

  const element = await prisma.widgetElement.create({
    data: {
      widgetId,
      name: preset?.name ?? "Новый элемент",
      kind: preset ? "preset" : "custom",
      presetId: preset?.id,
      x: 40 + offset,
      y: 40 + offset,
      width: preset?.width ?? 400,
      height: preset?.height ?? 300,
      html: preset?.html ?? "",
      css: preset?.css ?? "",
      js: preset?.js ?? "",
      fieldsSchema: (preset?.fieldsSchema ?? []) as unknown as Prisma.InputJsonValue,
      fieldValues: (preset ? defaultFieldValues(preset.fieldsSchema) : {}) as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(element, { status: 201 });
}
