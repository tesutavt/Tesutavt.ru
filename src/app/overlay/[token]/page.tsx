import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OverlayLiveEvents } from "@/components/canvas/OverlayLiveEvents";
import { resolveWidgetChannel } from "@/lib/twitch-channel";

export default async function OverlayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const widget = await prisma.widget.findUnique({
    where: { overlayToken: token },
    include: { elements: true },
  });

  if (!widget) {
    notFound();
  }

  let channel = null;
  try {
    channel = await resolveWidgetChannel(widget.userId);
  } catch (err) {
    console.error("[overlay] не удалось получить данные канала", err);
  }

  return (
    <>
      <style>{`html, body { background: transparent !important; margin: 0; overflow: hidden; }`}</style>
      <OverlayLiveEvents
        canvasWidth={widget.canvasWidth}
        canvasHeight={widget.canvasHeight}
        elements={widget.elements.map((el) => ({
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          zIndex: el.zIndex,
          html: el.html,
          css: el.css,
          js: el.js,
          fieldValues: el.fieldValues as unknown as Record<string, unknown>,
        }))}
        overlayToken={token}
        channel={channel as unknown as Record<string, unknown> | null}
      />
    </>
  );
}
