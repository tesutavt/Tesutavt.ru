import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCors, corsPreflight } from "@/lib/music/cors";
import { resolveWidgetChannel } from "@/lib/twitch-channel";

// Постоянно опрашивается виджетами; без этого Next.js может закэшировать
// GET-ответ по [token] и отдавать один и тот же устаревший снимок вместо
// актуального состояния.
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ token: string }> };

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const widget = await prisma.widget.findUnique({
    where: { overlayToken: token },
    include: { elements: true },
  });

  if (!widget) {
    return withCors(NextResponse.json({ error: "Unknown overlay token" }, { status: 404 }));
  }

  // Не валим весь ответ, если Helix недоступен (истёкший токен, рейт-лимит
  // и т.п.) - холст и виджеты должны продолжать обновляться, просто без
  // свежих данных канала на этот раз.
  let channel = null;
  try {
    channel = await resolveWidgetChannel(widget.userId);
  } catch (err) {
    console.error("[overlay] не удалось получить данные канала", err);
  }

  return withCors(
    NextResponse.json({
      canvasWidth: widget.canvasWidth,
      canvasHeight: widget.canvasHeight,
      channel,
      elements: widget.elements.map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        zIndex: el.zIndex,
        html: el.html,
        css: el.css,
        js: el.js,
        fieldValues: el.fieldValues,
      })),
    })
  );
}
