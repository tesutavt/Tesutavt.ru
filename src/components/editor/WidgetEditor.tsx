"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, Share2 } from "lucide-react";
import { OverlayCanvas, type CanvasElementData, type OverlayCanvasHandle } from "@/components/canvas/OverlayCanvas";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { Inspector, type ElementPatch, type InspectorElementData } from "@/components/editor/Inspector";
import { getEventById } from "@/lib/twitch-fields";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import type { WidgetFieldSchema } from "@/lib/widget-types";

interface ElementData extends CanvasElementData {
  name: string;
  kind: string;
  fieldsSchema: WidgetFieldSchema[];
}

interface WidgetEditorProps {
  widgetId: string;
  overlayToken: string;
  initialName: string;
  initialCanvasWidth: number;
  initialCanvasHeight: number;
  initialElements: ElementData[];
}

type SaveState = "idle" | "saving" | "saved";

export function WidgetEditor({
  widgetId,
  overlayToken,
  initialName,
  initialCanvasWidth,
  initialCanvasHeight,
  initialElements,
}: WidgetEditorProps) {
  const confirm = useConfirm();
  const [name, setName] = useState(initialName);
  const [canvasWidth, setCanvasWidth] = useState(initialCanvasWidth);
  const [canvasHeight, setCanvasHeight] = useState(initialCanvasHeight);
  const [elements, setElements] = useState<ElementData[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(initialElements[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const canvasRef = useRef<OverlayCanvasHandle>(null);
  const pendingElementPatches = useRef<Record<string, Record<string, unknown>>>({});
  const elementSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const widgetSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;

  const flushElementPatch = useCallback(
    (elementId: string) => {
      const patch = pendingElementPatches.current[elementId];
      delete pendingElementPatches.current[elementId];
      if (!patch) return;
      fetch(`/api/widgets/${widgetId}/elements/${elementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(async (res) => {
        setSaveState(res.ok ? "saved" : "idle");
        const data = res.ok ? null : await res.json().catch(() => ({}));
        setSaveError(res.ok ? null : (data?.error ?? "Не получилось сохранить"));
      });
    },
    [widgetId]
  );

  const updateElement = useCallback(
    (elementId: string, patch: ElementPatch, immediate = false) => {
      setElements((prev) => prev.map((el) => (el.id === elementId ? { ...el, ...patch } : el)));
      pendingElementPatches.current[elementId] = {
        ...pendingElementPatches.current[elementId],
        ...patch,
      };
      setSaveState("saving");

      clearTimeout(elementSaveTimers.current[elementId]);
      if (immediate) {
        flushElementPatch(elementId);
      } else {
        elementSaveTimers.current[elementId] = setTimeout(() => flushElementPatch(elementId), 600);
      }
    },
    [flushElementPatch]
  );

  function saveWidgetSettings(patch: { name?: string; canvasWidth?: number; canvasHeight?: number }) {
    setSaveState("saving");
    clearTimeout(widgetSaveTimer.current);
    widgetSaveTimer.current = setTimeout(() => {
      fetch(`/api/widgets/${widgetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(async (res) => {
        setSaveState(res.ok ? "saved" : "idle");
        const data = res.ok ? null : await res.json().catch(() => ({}));
        setSaveError(res.ok ? null : (data?.error ?? "Не получилось сохранить"));
      });
    }, 600);
  }

  async function handleAddElement(presetId?: string) {
    const res = await fetch(`/api/widgets/${widgetId}/elements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId }),
    });
    if (!res.ok) return;
    const element = await res.json();
    setElements((prev) => [
      ...prev,
      {
        id: element.id,
        name: element.name,
        kind: element.kind,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        html: element.html,
        css: element.css,
        js: element.js,
        fieldsSchema: element.fieldsSchema as WidgetFieldSchema[],
        fieldValues: element.fieldValues as Record<string, unknown>,
      },
    ]);
    setSelectedId(element.id);
  }

  async function handleDeleteElement() {
    if (!selectedElement) return;
    const ok = await confirm({
      title: "Удалить элемент?",
      description: `«${selectedElement.name}» будет удалён с холста.`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;

    const id = selectedElement.id;
    const res = await fetch(`/api/widgets/${widgetId}/elements/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  function handleCopyOverlayUrl() {
    const url = `${window.location.origin}/overlay/${overlayToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleShare() {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
      return;
    }
    const res = await fetch(`/api/widgets/${widgetId}/share`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    const url = `${window.location.origin}/share/${data.token}`;
    setShareUrl(url);
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  }

  function handleTestEvent(eventId: string) {
    const event = getEventById(eventId);
    if (!event) return;
    canvasRef.current?.sendTestEvent(eventId, event.sample);
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col overflow-hidden rounded-3xl bg-[var(--surface)] shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-5 py-4">
        <Link
          href="/dashboard/widgets"
          className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] transition hover:text-[var(--surface-foreground)]"
        >
          <ArrowLeft size={15} /> Виджеты
        </Link>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            saveWidgetSettings({ name: e.target.value });
          }}
          className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-[var(--surface-foreground)] transition hover:border-[var(--border)] focus:border-accent focus:outline-none"
        />

        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <span>Холст:</span>
          <input
            type="number"
            value={canvasWidth}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCanvasWidth(v);
              saveWidgetSettings({ canvasWidth: v });
            }}
            className="w-16 rounded-lg border border-[var(--border)] bg-[var(--subtle)] px-2 py-1 text-[var(--surface-foreground)] outline-none focus:border-accent"
          />
          <span>×</span>
          <input
            type="number"
            value={canvasHeight}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCanvasHeight(v);
              saveWidgetSettings({ canvasHeight: v });
            }}
            className="w-16 rounded-lg border border-[var(--border)] bg-[var(--subtle)] px-2 py-1 text-[var(--surface-foreground)] outline-none focus:border-accent"
          />
        </div>

        <span className="text-xs text-[var(--muted-foreground)]">
          {saveError ? (
            <span className="text-danger">{saveError}</span>
          ) : saveState === "saving" ? (
            "Сохранение…"
          ) : saveState === "saved" ? (
            "Сохранено"
          ) : (
            ""
          )}
        </span>

        <button
          onClick={handleCopyOverlayUrl}
          className="flex items-center gap-1.5 rounded-full bg-[var(--subtle)] px-4 py-2 text-sm font-medium text-[var(--surface-foreground)] transition hover:opacity-80"
        >
          <Link2 size={14} /> {copied ? "Скопировано" : "Copy OBS URL"}
        </button>
        <button
          onClick={handleShare}
          title="Скопировать ссылку-приглашение — получатель увидит, что внутри, и сможет добавить себе копию"
          className="flex items-center gap-1.5 rounded-full bg-[var(--subtle)] px-4 py-2 text-sm font-medium text-[var(--surface-foreground)] transition hover:opacity-80"
        >
          <Share2 size={14} /> {shareCopied ? "Скопировано" : "Поделиться"}
        </button>
      </div>

      <div className="grid flex-1 grid-cols-[240px_1fr_360px] overflow-hidden">
        <div className="overflow-hidden border-r border-[var(--border)] bg-[var(--subtle)]">
          <LayersPanel
            elements={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={handleAddElement}
          />
        </div>

        <div className="overflow-hidden">
          <OverlayCanvas
            ref={canvasRef}
            editable
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            elements={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTransformChange={(id, transform) => updateElement(id, transform, true)}
            overlayToken={overlayToken}
          />
        </div>

        <div className="overflow-hidden border-l border-[var(--border)]">
          {selectedElement ? (
            <Inspector
              element={selectedElement as InspectorElementData}
              onChange={(patch, immediate) => updateElement(selectedElement.id, patch, immediate)}
              onDelete={handleDeleteElement}
              onTestEvent={handleTestEvent}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--muted-foreground)]">
              Выберите элемент на холсте или в списке слева, либо добавьте новый.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
