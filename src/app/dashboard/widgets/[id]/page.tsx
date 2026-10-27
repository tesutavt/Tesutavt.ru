import { notFound } from "next/navigation";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { WidgetEditor } from "@/components/editor/WidgetEditor";
import type { WidgetFieldSchema } from "@/lib/widget-types";

export default async function WidgetEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await panelSession();
  const widget = await prisma.widget.findUnique({
    where: { id },
    include: { elements: { orderBy: { createdAt: "asc" } } },
  });

  if (!widget || widget.userId !== session!.user.id) {
    notFound();
  }

  return (
    <WidgetEditor
      widgetId={widget.id}
      overlayToken={widget.overlayToken}
      initialName={widget.name}
      initialCanvasWidth={widget.canvasWidth}
      initialCanvasHeight={widget.canvasHeight}
      initialElements={widget.elements.map((el) => ({
        id: el.id,
        name: el.name,
        kind: el.kind,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        zIndex: el.zIndex,
        html: el.html,
        css: el.css,
        js: el.js,
        fieldsSchema: el.fieldsSchema as unknown as WidgetFieldSchema[],
        fieldValues: el.fieldValues as Record<string, unknown>,
      }))}
    />
  );
}
