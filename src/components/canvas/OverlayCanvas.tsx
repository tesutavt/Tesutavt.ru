"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { buildWidgetDocument } from "@/lib/build-widget-document";

export interface CanvasElementData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  html: string;
  css: string;
  js: string;
  fieldValues: Record<string, unknown>;
}

export interface OverlayCanvasHandle {
  /** Broadcasts a test event to every element's window.onWidgetEvent hook. */
  sendTestEvent: (type: string, data: unknown) => void;
  /** Пушит обновлённые данные канала во все элементы через postMessage (НЕ
   *  через проп channel/ре-рендер — иначе srcDoc каждого элемента менялся
   *  бы при каждом обновлении фолловеров и виджеты перезагружались бы
   *  целиком, прерывая, например, играющий трек в соседнем плеере). */
  sendChannelUpdate: (channel: Record<string, unknown>) => void;
}

interface OverlayCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
  elements: CanvasElementData[];
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onTransformChange?: (
    id: string,
    transform: { x: number; y: number; width: number; height: number }
  ) => void;
  /** overlayToken холста — прокидывается в window.widget.overlayToken каждого элемента. */
  overlayToken?: string | null;
  /** Настоящие данные канала (follower count и т.д.) - только на реальном
   *  оверлее, см. OverlayLiveEvents.tsx. В редакторе не передаётся. */
  channel?: Record<string, unknown> | null;
}

export const OverlayCanvas = forwardRef<OverlayCanvasHandle, OverlayCanvasProps>(
  function OverlayCanvas(
    {
      canvasWidth,
      canvasHeight,
      elements,
      editable = false,
      selectedId = null,
      onSelect,
      onTransformChange,
      overlayToken = null,
      channel = null,
    },
    ref
  ) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const frameRegistry = useRef<Map<string, HTMLIFrameElement>>(new Map());

    useImperativeHandle(ref, () => ({
      sendTestEvent(type, data) {
        for (const frame of frameRegistry.current.values()) {
          frame.contentWindow?.postMessage({ __vtubeTestEvent: true, type, data }, "*");
        }
      },
      sendChannelUpdate(channelData) {
        for (const frame of frameRegistry.current.values()) {
          frame.contentWindow?.postMessage({ __vtubeChannelUpdate: true, channel: channelData }, "*");
        }
      },
    }));

    useEffect(() => {
      if (!editable) return;
      const el = wrapperRef.current;
      if (!el) return;

      const updateScale = () => {
        const { width, height } = el.getBoundingClientRect();
        const nextScale = Math.min(width / canvasWidth, height / canvasHeight, 1);
        setScale(nextScale > 0 ? nextScale : 1);
      };

      updateScale();
      const observer = new ResizeObserver(updateScale);
      observer.observe(el);
      return () => observer.disconnect();
    }, [editable, canvasWidth, canvasHeight]);

    const canvasBody = (
      <div
        className="relative"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: editable ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          backgroundImage: editable
            ? "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%)"
            : undefined,
          backgroundSize: editable ? "20px 20px" : undefined,
        }}
        onMouseDown={() => editable && onSelect?.(null)}
      >
        {elements.map((element) =>
          editable ? (
            <Rnd
              key={element.id}
              size={{ width: element.width, height: element.height }}
              position={{ x: element.x, y: element.y }}
              scale={scale}
              style={{ zIndex: element.zIndex }}
              bounds="parent"
              onMouseDown={(e: MouseEvent) => {
                e.stopPropagation();
                onSelect?.(element.id);
              }}
              onDragStop={(_e, d) =>
                onTransformChange?.(element.id, {
                  x: Math.round(d.x),
                  y: Math.round(d.y),
                  width: element.width,
                  height: element.height,
                })
              }
              onResizeStop={(_e, _direction, ref, _delta, position) =>
                onTransformChange?.(element.id, {
                  x: Math.round(position.x),
                  y: Math.round(position.y),
                  width: parseInt(ref.style.width, 10),
                  height: parseInt(ref.style.height, 10),
                })
              }
              className={
                selectedId === element.id
                  ? "outline outline-2 outline-violet-500"
                  : "outline outline-1 outline-white/10"
              }
            >
              <ElementFrame element={element} locked registryRef={frameRegistry} overlayToken={overlayToken} channel={channel} />
            </Rnd>
          ) : (
            <div
              key={element.id}
              style={{
                position: "absolute",
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                zIndex: element.zIndex,
              }}
            >
              <ElementFrame element={element} registryRef={frameRegistry} overlayToken={overlayToken} channel={channel} />
            </div>
          )
        )}
      </div>
    );

    if (!editable) {
      return canvasBody;
    }

    return (
      <div
        ref={wrapperRef}
        className="flex h-full w-full items-center justify-center overflow-hidden bg-neutral-950"
      >
        <div style={{ width: canvasWidth * scale, height: canvasHeight * scale }}>
          {canvasBody}
        </div>
      </div>
    );
  }
);

function ElementFrame({
  element,
  locked,
  registryRef,
  overlayToken,
  channel,
  restrictedSandbox,
}: {
  element: CanvasElementData;
  locked?: boolean;
  registryRef: React.RefObject<Map<string, HTMLIFrameElement>>;
  overlayToken?: string | null;
  channel?: Record<string, unknown> | null;
  /** Оставлено для будущего разделения (например если появится импорт/шеринг
   *  чужих виджетов) — сейчас нигде не передаётся true. Причина: YouTube и
   *  любой другой встроенный <iframe> внутри виджета наследует sandbox-флаги
   *  своего родителя. Без allow-same-origin вложенный плеер получает opaque
   *  origin и грузится, но не проигрывает — а это ломало и предпросмотр в
   *  редакторе, и сам оверлей. allow-same-origin на srcDoc-iframe отдаёт ему
   *  origin родительской страницы, то есть скрипт виджета получает доступ к
   *  сессии дашборда — но виджеты сейчас пишет только сам владелец аккаунта
   *  (импорта чужого кода нет), так что это self-XSS, а не реальная эскалация. */
  restrictedSandbox?: boolean;
}) {
  const srcDoc = buildWidgetDocument({
    html: element.html,
    css: element.css,
    js: element.js,
    fieldValues: element.fieldValues,
    overlayToken,
    channel,
  });

  return (
    <iframe
      ref={(node) => {
        if (node) registryRef.current.set(element.id, node);
        else registryRef.current.delete(element.id);
      }}
      title={element.id}
      sandbox={
        restrictedSandbox
          ? "allow-scripts"
          : "allow-scripts allow-same-origin allow-popups allow-presentation"
      }
      srcDoc={srcDoc}
      style={{
        width: "100%",
        height: "100%",
        border: 0,
        background: "transparent",
        pointerEvents: locked ? "none" : undefined,
      }}
    />
  );
}
