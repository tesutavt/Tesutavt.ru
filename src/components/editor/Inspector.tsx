"use client";

import { useRef, useState } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Code2, Palette, Braces, SlidersHorizontal, Trash2, ChevronRight } from "lucide-react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { FieldsPanel } from "@/components/editor/FieldsPanel";
import { TwitchDataPanel } from "@/components/editor/TwitchDataPanel";
import { CodeModal } from "@/components/editor/CodeModal";
import { TWITCH_EVENTS } from "@/lib/twitch-fields";
import type { WidgetFieldSchema } from "@/lib/widget-types";

export interface InspectorElementData {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  html: string;
  css: string;
  js: string;
  fieldsSchema: WidgetFieldSchema[];
  fieldValues: Record<string, unknown>;
}

export interface ElementPatch {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  html?: string;
  css?: string;
  js?: string;
  fieldsSchema?: WidgetFieldSchema[];
  fieldValues?: Record<string, unknown>;
}

type ModalKind = "html" | "css" | "js" | "fields" | null;

interface InspectorProps {
  element: InspectorElementData;
  onChange: (patch: ElementPatch, immediate?: boolean) => void;
  onDelete: () => void;
  onTestEvent: (eventId: string) => void;
}

export function Inspector({ element, onChange, onDelete, onTestEvent }: InspectorProps) {
  const [modal, setModal] = useState<ModalKind>(null);
  const jsEditorRef = useRef<ReactCodeMirrorRef>(null);

  function insertIntoJs(snippet: string) {
    const view = jsEditorRef.current?.view;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: snippet },
      selection: { anchor: from + snippet.length },
    });
    view.focus();
    onChange({ js: view.state.doc.toString() });
  }

  const codeRows = [
    { key: "html" as const, label: "HTML", icon: Code2, meta: `${element.html.split("\n").length} строк` },
    { key: "css" as const, label: "CSS", icon: Palette, meta: `${element.css.split("\n").length} строк` },
    { key: "js" as const, label: "JS", icon: Braces, meta: `${element.js.split("\n").length} строк` },
    {
      key: "fields" as const,
      label: "Fields",
      icon: SlidersHorizontal,
      meta: `${element.fieldsSchema.length} полей`,
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-[var(--border)] p-4">
        <input
          value={element.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="mb-3 w-full rounded-xl border border-[var(--border)] bg-[var(--subtle)] px-3 py-2 text-sm font-medium text-[var(--surface-foreground)] outline-none focus:border-accent"
        />
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Transform
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <NumberField label="X" value={element.x} onChange={(v) => onChange({ x: v }, true)} />
          <NumberField label="Y" value={element.y} onChange={(v) => onChange({ y: v }, true)} />
          <NumberField label="W" value={element.width} onChange={(v) => onChange({ width: v }, true)} />
          <NumberField label="H" value={element.height} onChange={(v) => onChange({ height: v }, true)} />
          <NumberField
            label="Z-index"
            value={element.zIndex}
            onChange={(v) => onChange({ zIndex: v }, true)}
          />
        </div>
      </div>

      <div className="border-b border-[var(--border)] p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Код и настройки
        </p>
        <div className="flex flex-col gap-1.5">
          {codeRows.map((row) => (
            <button
              key={row.key}
              onClick={() => setModal(row.key)}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--subtle)] px-3 py-2.5 text-left transition hover:border-neutral-400 hover:bg-[var(--surface)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] shadow-card">
                <row.icon size={15} className="text-[var(--muted-foreground)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--surface-foreground)]">{row.label}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">{row.meta}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-[var(--muted-foreground)]" />
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-[var(--border)] p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Тестовые события
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TWITCH_EVENTS.map((event) => (
            <button
              key={event.id}
              onClick={() => onTestEvent(event.id)}
              className="rounded-full bg-[var(--subtle)] px-3 py-1.5 text-xs font-medium text-[var(--surface-foreground)] transition hover:opacity-80"
            >
              ▶ {event.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <button
          onClick={onDelete}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-danger/40 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
        >
          <Trash2 size={15} /> Удалить элемент
        </button>
      </div>

      {modal === "html" && (
        <CodeModal title="HTML" onClose={() => setModal(null)}>
          <CodeEditor language="html" value={element.html} onChange={(v) => onChange({ html: v })} />
        </CodeModal>
      )}
      {modal === "css" && (
        <CodeModal title="CSS" onClose={() => setModal(null)}>
          <CodeEditor language="css" value={element.css} onChange={(v) => onChange({ css: v })} />
        </CodeModal>
      )}
      {modal === "js" && (
        <CodeModal
          title="JavaScript"
          onClose={() => setModal(null)}
          sidebar={<TwitchDataPanel disabled={false} onInsert={insertIntoJs} />}
        >
          <CodeEditor ref={jsEditorRef} language="js" value={element.js} onChange={(v) => onChange({ js: v })} />
        </CodeModal>
      )}
      {modal === "fields" && (
        <CodeModal title="Fields" onClose={() => setModal(null)}>
          <FieldsPanel
            fields={element.fieldsSchema}
            values={element.fieldValues}
            onChange={(fields, values) => onChange({ fieldsSchema: fields, fieldValues: values })}
          />
        </CodeModal>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
      <span className="w-14 shrink-0">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--subtle)] px-2 py-1 text-[var(--surface-foreground)] outline-none focus:border-accent"
      />
    </label>
  );
}
