"use client";

import { useEffect, useRef, useState } from "react";
import { OverlayCanvas, type CanvasElementData, type OverlayCanvasHandle } from "@/components/canvas/OverlayCanvas";

interface OverlayLiveEventsProps {
  canvasWidth: number;
  canvasHeight: number;
  elements: CanvasElementData[];
  overlayToken: string;
  channel: Record<string, unknown> | null;
}

const EVENTS_POLL_MS = 1500;
const WIDGET_POLL_MS = 3000;

/**
 * Обёртка вокруг OverlayCanvas для настоящей страницы /overlay/[token].
 * Два независимых поллинга:
 *
 * 1. События (chatMessage и т.п.) — GET .../events?since=N, разносятся по
 *    виджетам тем же postMessage-каналом (__vtubeTestEvent), что и кнопка
 *    "Test event" в редакторе.
 *
 * 2. Живое содержимое холста — GET .../widget, раз в WIDGET_POLL_MS. Если
 *    html/css/js/fieldValues какого-то элемента изменились в редакторе,
 *    состояние обновляется и OverlayCanvas перерисовывает ИМЕННО этот
 *    iframe (элементы у него keyed по id, так что реакт не трогает
 *    остальные) — не нужно руками обновлять источник в OBS. Тот же ответ
 *    несёт свежие данные канала (фолловеры и т.д.) — они НЕ идут через
 *    проп/ре-рендер (иначе srcDoc каждого элемента менялся бы при каждом
 *    новом фолловере и виджеты перезагружались бы целиком), а пушатся тем
 *    же postMessage-каналом через sendChannelUpdate - виджет ловит их
 *    через window.onChannelUpdate(channel), если определил такой хук.
 */
export function OverlayLiveEvents({
  canvasWidth: initialCanvasWidth,
  canvasHeight: initialCanvasHeight,
  elements: initialElements,
  overlayToken,
  channel: initialChannel,
}: OverlayLiveEventsProps) {
  const canvasRef = useRef<OverlayCanvasHandle>(null);
  const [canvasWidth, setCanvasWidth] = useState(initialCanvasWidth);
  const [canvasHeight, setCanvasHeight] = useState(initialCanvasHeight);
  const [elements, setElements] = useState(initialElements);

  useEffect(() => {
    let cancelled = false;
    let sinceSeq = 0;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/public/overlay/${overlayToken}/events?since=${sinceSeq}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const body = (await res.json()) as { events: { type: string; data: unknown }[]; latestSeq: number };
          for (const event of body.events) {
            canvasRef.current?.sendTestEvent(event.type, event.data);
          }
          sinceSeq = body.latestSeq;
        }
      } catch (err) {
        console.error("[overlay] ошибка опроса событий", err);
      }
      if (!cancelled) timer = setTimeout(poll, EVENTS_POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [overlayToken]);

  useEffect(() => {
    let cancelled = false;
    let lastElementsSnapshot = JSON.stringify(initialElements);
    let lastChannelSnapshot = JSON.stringify(initialChannel);
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/public/overlay/${overlayToken}/widget`, { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as {
            canvasWidth: number;
            canvasHeight: number;
            elements: CanvasElementData[];
            channel: Record<string, unknown> | null;
          };
          const elementsSnapshot = JSON.stringify(body.elements);
          if (elementsSnapshot !== lastElementsSnapshot) {
            lastElementsSnapshot = elementsSnapshot;
            setElements(body.elements);
          }
          const channelSnapshot = JSON.stringify(body.channel);
          if (channelSnapshot !== lastChannelSnapshot && body.channel) {
            lastChannelSnapshot = channelSnapshot;
            canvasRef.current?.sendChannelUpdate(body.channel);
          }
          setCanvasWidth(body.canvasWidth);
          setCanvasHeight(body.canvasHeight);
        }
      } catch (err) {
        console.error("[overlay] ошибка опроса содержимого холста", err);
      }
      if (!cancelled) timer = setTimeout(poll, WIDGET_POLL_MS);
    }

    timer = setTimeout(poll, WIDGET_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayToken]);

  return (
    <OverlayCanvas
      ref={canvasRef}
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      elements={elements}
      overlayToken={overlayToken}
      channel={initialChannel}
    />
  );
}
