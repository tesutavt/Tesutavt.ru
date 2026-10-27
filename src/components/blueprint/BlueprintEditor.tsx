"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import {
  NODE_DEFS,
  HTTP_METHODS,
  createNode,
  nodeAvailableIn,
  type BpContextKind,
  type BpNode,
  type BpEdge,
  type BpGraph,
  type BpNodeType,
  type HttpKeyValue,
  type PinDef,
} from "@/lib/blueprint/types";

export interface ViewerFieldOption {
  key: string;
  label: string;
}

const TRIGGER_HINT: Record<BpContextKind, string> = {
  command: "{user}, {message}, {args}, {channel}",
  reward: "{user}, {input}, {reward}, {cost}, {channel}",
};

const NODE_WIDTH = 220;
const ROW_HEIGHT = 26;
const HEADER_HEIGHT = 34;

function nodePins(node: BpNode): { inputs: PinDef[]; outputs: PinDef[] } {
  const def = NODE_DEFS[node.type];
  const inputs = [...def.inputs];
  if (def.supportsExtraInputs) {
    const extra = Array.isArray(node.data.extraInputs) ? (node.data.extraInputs as string[]) : [];
    inputs.push(...extra.map((name) => ({ name, kind: "data" as const })));
  }
  const outputs = [...def.outputs];
  if (def.supportsExtraOutputs) {
    const extra = Array.isArray(node.data.extraOutputs) ? (node.data.extraOutputs as string[]) : [];
    outputs.push(...extra.map((name) => ({ name, kind: "data" as const })));
  }
  return { inputs, outputs };
}

function pinPos(node: BpNode, side: "in" | "out", index: number): { x: number; y: number } {
  return {
    x: node.x + (side === "in" ? 0 : NODE_WIDTH),
    y: node.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2,
  };
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

interface WireDraft {
  fromNode: string;
  fromPin: string;
  kind: "exec" | "data";
  side: "in" | "out";
  startX: number;
  startY: number;
  x: number;
  y: number;
}

export function BlueprintEditor({
  title,
  saveUrl,
  backHref,
  backLabel,
  contextKind,
  initialGraph,
  viewerFields,
}: {
  title: string;
  /** PATCH сюда с { graph } (а для команд ещё и mode: "graph"). */
  saveUrl: string;
  backHref: string;
  backLabel: string;
  contextKind: BpContextKind;
  initialGraph: BpGraph;
  viewerFields: ViewerFieldOption[];
}) {
  const [nodes, setNodes] = useState<BpNode[]>(initialGraph.nodes);
  const [edges, setEdges] = useState<BpEdge[]>(initialGraph.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [wireDraft, setWireDraft] = useState<WireDraft | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const save = useCallback(
    async (nextNodes: BpNode[], nextEdges: BpEdge[]) => {
      setSaveState("saving");
      const graph = { nodes: nextNodes, edges: nextEdges };
      const res = await fetch(saveUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contextKind === "command" ? { mode: "graph", graph } : { graph }),
      }).catch(() => null);
      if (res?.ok) {
        setSaveState("saved");
        setSaveError(null);
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      } else {
        const data = res ? await res.json().catch(() => ({})) : {};
        setSaveState("error");
        setSaveError((data as { error?: string }).error ?? "Ошибка сохранения");
      }
    },
    [saveUrl, contextKind]
  );

  // Автосохранение с debounce при любом изменении графа.
  useEffect(() => {
    const timer = setTimeout(() => save(nodes, edges), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  function canvasPoint(e: React.MouseEvent | MouseEvent): { x: number; y: number } {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  }

  function addNode(type: BpNodeType) {
    const p = canvasPoint({ clientX: 300, clientY: 200 } as MouseEvent);
    setNodes((prev) => [...prev, createNode(type, p.x + Math.random() * 40, p.y + Math.random() * 40)]);
  }

  function deleteNode(id: string) {
    if (id === "trigger") return;
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.fromNode !== id && e.toNode !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function patchNodeData(id: string, patch: Record<string, unknown>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }

  // --- Перетаскивание узла ---
  function onNodeMouseDown(e: React.MouseEvent, node: BpNode) {
    e.stopPropagation();
    const p = canvasPoint(e);
    dragRef.current = { nodeId: node.id, offsetX: p.x - node.x, offsetY: p.y - node.y };
    setSelectedId(node.id);
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragRef.current) {
        const p = canvasPoint(e);
        const { nodeId, offsetX, offsetY } = dragRef.current;
        setNodes((prev) =>
          prev.map((n) => (n.id === nodeId ? { ...n, x: p.x - offsetX, y: p.y - offsetY } : n))
        );
      } else if (wireDraft) {
        const p = canvasPoint(e);
        setWireDraft((prev) => (prev ? { ...prev, x: p.x, y: p.y } : prev));
      }
    }
    function onUp() {
      dragRef.current = null;
      setWireDraft(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [wireDraft]);

  // --- Провода ---
  function startWire(node: BpNode, side: "in" | "out", pin: PinDef, index: number) {
    const pos = pinPos(node, side, index);
    setWireDraft({ fromNode: node.id, fromPin: pin.name, kind: pin.kind, side, startX: pos.x, startY: pos.y, x: pos.x, y: pos.y });
  }

  function finishWire(node: BpNode, side: "in" | "out", pin: PinDef) {
    if (!wireDraft) return;
    if (wireDraft.side === side) {
      setWireDraft(null);
      return; // выход можно соединить только со входом
    }
    if (wireDraft.kind !== pin.kind) {
      setWireDraft(null);
      return; // exec только с exec, data только с data
    }
    const outEnd = side === "in" ? { node: wireDraft.fromNode, pin: wireDraft.fromPin } : { node: node.id, pin: pin.name };
    const inEnd = side === "in" ? { node: node.id, pin: pin.name } : { node: wireDraft.fromNode, pin: wireDraft.fromPin };
    if (outEnd.node === inEnd.node) {
      setWireDraft(null);
      return; // без самозацикливания на себя
    }

    setEdges((prev) => [
      // у входного пина - максимум одно ребро
      ...prev.filter((e) => !(e.toNode === inEnd.node && e.toPin === inEnd.pin)),
      {
        id: "e" + Math.random().toString(36).slice(2, 10),
        fromNode: outEnd.node,
        fromPin: outEnd.pin,
        toNode: inEnd.node,
        toPin: inEnd.pin,
      },
    ]);
    setWireDraft(null);
  }

  const addableTypes = Object.values(NODE_DEFS).filter((d) => d.addable && nodeAvailableIn(d, contextKind));

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--surface-foreground)]"
        >
          <ArrowLeft size={16} /> {backLabel}
        </Link>
        <span className="font-mono text-sm font-medium text-[var(--surface-foreground)]">{title}</span>
        <span className="text-xs text-[var(--muted-foreground)]">Blueprint</span>
        <div className="ml-auto flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          {saveState === "saving" && "Сохраняю…"}
          {saveState === "saved" && "Сохранено"}
          {saveState === "error" && (
            <span className="flex items-center gap-1 text-danger">
              <AlertCircle size={13} /> {saveError ?? "Ошибка сохранения"}
            </span>
          )}
          <button
            onClick={() => save(nodes, edges)}
            className="flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--ink-foreground)] hover:opacity-90"
          >
            <Save size={13} /> Сохранить
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Палитра */}
        <div className="flex w-52 shrink-0 flex-col gap-2 overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Блоки</p>
          {addableTypes.map((def) => (
            <button
              key={def.type}
              onClick={() => addNode(def.type)}
              title={def.description}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left text-xs text-[var(--surface-foreground)] hover:opacity-80"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: def.color }} />
              <span className="flex-1">{def.label}</span>
              <Plus size={12} className="text-[var(--muted-foreground)]" />
            </button>
          ))}
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            Тяните из точки на правом краю блока в точку на левом краю другого - фиолетовые точки это порядок
            выполнения, остальные - данные. {TRIGGER_HINT[contextKind]} и {"{viewer.поле}"} (данные зрителя из
            !set) доступны в любом текстовом поле без проводов.
          </p>
        </div>

        {/* Канвас */}
        <div
          ref={canvasRef}
          onMouseDown={() => setSelectedId(null)}
          className="relative flex-1 overflow-auto bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:20px_20px]"
          style={{ minHeight: 800 }}
        >
          <svg className="pointer-events-none absolute left-0 top-0 h-[3000px] w-[3000px]">
            {edges.map((edge) => {
              const from = nodes.find((n) => n.id === edge.fromNode);
              const to = nodes.find((n) => n.id === edge.toNode);
              if (!from || !to) return null;
              const fromPins = nodePins(from).outputs;
              const toPins = nodePins(to).inputs;
              const fi = fromPins.findIndex((p) => p.name === edge.fromPin);
              const ti = toPins.findIndex((p) => p.name === edge.toPin);
              if (fi === -1 || ti === -1) return null;
              const p1 = pinPos(from, "out", fi);
              const p2 = pinPos(to, "in", ti);
              const isExec = fromPins[fi].kind === "exec";
              return (
                <path
                  key={edge.id}
                  d={bezier(p1.x, p1.y, p2.x, p2.y)}
                  stroke={isExec ? "#7c3aed" : "#059669"}
                  strokeWidth={2}
                  fill="none"
                  className="pointer-events-auto cursor-pointer"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setEdges((prev) => prev.filter((x) => x.id !== edge.id));
                  }}
                />
              );
            })}
            {wireDraft && (
              <path
                d={bezier(wireDraft.startX, wireDraft.startY, wireDraft.x, wireDraft.y)}
                stroke={wireDraft.kind === "exec" ? "#7c3aed" : "#059669"}
                strokeWidth={2}
                strokeDasharray="4 3"
                fill="none"
              />
            )}
          </svg>

          {nodes.map((node) => {
            const def = NODE_DEFS[node.type];
            const { inputs, outputs } = nodePins(node);
            const rows = Math.max(inputs.length, outputs.length);
            return (
              <div
                key={node.id}
                onMouseDown={(e) => onNodeMouseDown(e, node)}
                className="absolute cursor-grab select-none rounded-xl border shadow-sm active:cursor-grabbing"
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_WIDTH,
                  borderColor: selectedId === node.id ? def.color : "var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div
                  className="flex items-center justify-between rounded-t-xl px-2.5 py-1.5 text-xs font-medium text-white"
                  style={{ background: def.color, height: HEADER_HEIGHT }}
                >
                  <span className="truncate">{def.label}</span>
                  {node.type !== "trigger" && (
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => deleteNode(node.id)}
                      className="opacity-80 hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div style={{ height: rows * ROW_HEIGHT || 6 }} className="relative py-0.5 text-[11px]">
                  {inputs.map((pin, i) => (
                    <div
                      key={"in" + pin.name}
                      className="absolute left-0 flex items-center gap-1.5"
                      style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                      <span
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startWire(node, "in", pin, i);
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          finishWire(node, "in", pin);
                        }}
                        className="-ml-1.5 h-3 w-3 shrink-0 cursor-crosshair rounded-full border-2"
                        style={{
                          borderColor: pin.kind === "exec" ? "#7c3aed" : "#059669",
                          background: "var(--surface)",
                        }}
                      />
                      <span className="truncate text-[var(--muted-foreground)]">{pin.label ?? pin.name}</span>
                    </div>
                  ))}
                  {outputs.map((pin, i) => (
                    <div
                      key={"out" + pin.name}
                      className="absolute right-0 flex items-center justify-end gap-1.5"
                      style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT, left: 0 }}
                    >
                      <span className="truncate text-[var(--muted-foreground)]">{pin.label ?? pin.name}</span>
                      <span
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startWire(node, "out", pin, i);
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          finishWire(node, "out", pin);
                        }}
                        className="-mr-1.5 h-3 w-3 shrink-0 cursor-crosshair rounded-full border-2"
                        style={{
                          borderColor: pin.kind === "exec" ? "#7c3aed" : "#059669",
                          background: "var(--surface)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Инспектор */}
        <div className="w-80 shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-3">
          {!selectedNode ? (
            <p className="text-sm text-[var(--muted-foreground)]">Выберите блок, чтобы настроить его.</p>
          ) : (
            <NodeInspector
              node={selectedNode}
              viewerFields={viewerFields}
              onChange={(patch) => patchNodeData(selectedNode.id, patch)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PinListEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-[var(--surface-foreground)]">{label}</p>
      {values.map((name) => (
        <div key={name} className="flex items-center gap-1.5">
          <span className="flex-1 rounded-lg bg-[var(--subtle)] px-2 py-1 font-mono text-xs">{name}</span>
          <button
            onClick={() => onChange(values.filter((v) => v !== name))}
            className="text-[var(--muted-foreground)] hover:text-danger"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
          placeholder="имя_параметра"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs outline-none"
        />
        <button
          onClick={() => {
            if (draft && !values.includes(draft)) onChange([...values, draft]);
            setDraft("");
          }}
          className="rounded-lg bg-[var(--ink)] px-2 py-1 text-xs text-[var(--ink-foreground)]"
        >
          +
        </button>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm outline-none";

function KeyValueEditor({
  label,
  values,
  keyPlaceholder,
  valuePlaceholder,
  onChange,
}: {
  label: string;
  values: HttpKeyValue[];
  keyPlaceholder: string;
  valuePlaceholder: string;
  onChange: (next: HttpKeyValue[]) => void;
}) {
  const update = (i: number, patch: Partial<HttpKeyValue>) =>
    onChange(values.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <p className="font-medium text-[var(--surface-foreground)]">{label}</p>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={v.key}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder={keyPlaceholder}
            className={`${INPUT_CLASS} w-0 flex-1 font-mono text-xs`}
          />
          <input
            value={v.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={valuePlaceholder}
            className={`${INPUT_CLASS} w-0 flex-[1.4] font-mono text-xs`}
          />
          <button
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="text-[var(--muted-foreground)] hover:text-danger"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...values, { key: "", value: "" }])}
        className="self-start rounded-lg bg-[var(--subtle)] px-2 py-1 text-xs text-[var(--surface-foreground)] hover:opacity-80"
      >
        + добавить
      </button>
    </div>
  );
}

function ViewerFieldSelect({
  value,
  fields,
  onChange,
}: {
  value: string;
  fields: ViewerFieldOption[];
  onChange: (key: string) => void;
}) {
  const known = fields.some((f) => f.key === value);
  return (
    <label className="flex flex-col gap-1 text-xs">
      Поле (вкладка «Зрители»)
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}>
        {!known && <option value={value}>{value || "—"}</option>}
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label} ({f.key})
          </option>
        ))}
      </select>
    </label>
  );
}

function NodeInspector({
  node,
  viewerFields,
  onChange,
}: {
  node: BpNode;
  viewerFields: ViewerFieldOption[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const def = NODE_DEFS[node.type];
  const extraInputs = Array.isArray(node.data.extraInputs) ? (node.data.extraInputs as string[]) : [];
  const extraOutputs = Array.isArray(node.data.extraOutputs) ? (node.data.extraOutputs as string[]) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-[var(--surface-foreground)]">{def.label}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{def.description}</p>
      </div>

      {node.type === "sendMessage" && (
        <label className="flex flex-col gap-1 text-xs">
          Текст сообщения
          <textarea
            value={String(node.data.text ?? "")}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={4}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm outline-none"
          />
        </label>
      )}

      {node.type === "httpRequest" && <HttpRequestInspector node={node} onChange={onChange} />}

      {node.type === "viewerGet" && (
        <>
          <ViewerFieldSelect
            value={String(node.data.key ?? "")}
            fields={viewerFields}
            onChange={(key) => onChange({ key })}
          />
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Подключите ник ко входу «ник», чтобы прочитать данные другого зрителя (например из {"{args}"}).
          </p>
        </>
      )}

      {node.type === "viewerSet" && (
        <>
          <ViewerFieldSelect
            value={String(node.data.key ?? "")}
            fields={viewerFields}
            onChange={(key) => onChange({ key })}
          />
          <label className="flex flex-col gap-1 text-xs">
            Значение
            <input
              value={String(node.data.value ?? "")}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="{args}"
              className={`${INPUT_CLASS} font-mono`}
            />
          </label>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Проверяется так же, как !set: дата — ДД.ММ.ГГГГ, число — число. Если не подошло — идём по выходу «Ошибка».
          </p>
        </>
      )}

      {node.type === "redemptionStatus" && (
        <>
          <label className="flex flex-col gap-1 text-xs">
            Действие
            <select
              value={String(node.data.status ?? "FULFILLED")}
              onChange={(e) => onChange({ status: e.target.value })}
              className={INPUT_CLASS}
            >
              <option value="FULFILLED">Выполнено</option>
              <option value="CANCELED">Отменить и вернуть баллы</option>
            </select>
          </label>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Работает, только если у награды выключено «Сразу выполнять» — иначе Twitch сам помечает её выполненной.
          </p>
        </>
      )}

      {node.type === "getJsonPath" && (
        <label className="flex flex-col gap-1 text-xs">
          Путь в JSON (напр. current.temp_c)
          <input
            value={String(node.data.path ?? "")}
            onChange={(e) => onChange({ path: e.target.value })}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm outline-none font-mono"
          />
        </label>
      )}

      {node.type === "template" && (
        <label className="flex flex-col gap-1 text-xs">
          Шаблон текста
          <textarea
            value={String(node.data.text ?? "")}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={4}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm outline-none"
          />
        </label>
      )}

      {node.type === "vtsHotkey" && (
        <label className="flex flex-col gap-1 text-xs">
          Имя триггера (вкладка VTube Studio)
          <input
            value={String(node.data.name ?? "")}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="wave"
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm outline-none font-mono"
          />
        </label>
      )}

      {node.type === "customJs" && (
        <label className="flex flex-col gap-1 text-xs">
          Код (function run(inputs) {"{"} return {"{"} имя: значение {"}"}; {"}"})
          <div className="h-48 overflow-hidden rounded-lg border border-[var(--border)]">
            <CodeEditor language="js" value={String(node.data.code ?? "")} onChange={(v) => onChange({ code: v })} />
          </div>
        </label>
      )}

      {def.supportsExtraInputs && (
        <PinListEditor label="Входные параметры (data)" values={extraInputs} onChange={(v) => onChange({ extraInputs: v })} />
      )}
      {def.supportsExtraOutputs && (
        <PinListEditor label="Выходные параметры" values={extraOutputs} onChange={(v) => onChange({ extraOutputs: v })} />
      )}
    </div>
  );
}

function HttpRequestInspector({
  node,
  onChange,
}: {
  node: BpNode;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const method = String(node.data.method ?? "GET");
  const bodyType = String(node.data.bodyType ?? "none");
  const headers = Array.isArray(node.data.headers) ? (node.data.headers as HttpKeyValue[]) : [];
  const formFields = Array.isArray(node.data.formFields) ? (node.data.formFields as HttpKeyValue[]) : [];

  return (
    <>
      <div className="flex gap-2">
        <label className="flex flex-col gap-1 text-xs">
          Метод
          <select value={method} onChange={(e) => onChange({ method: e.target.value })} className={INPUT_CLASS}>
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Таймаут, сек
          <input
            type="number"
            min={1}
            max={10}
            value={Number(node.data.timeoutSec ?? 5)}
            onChange={(e) => onChange({ timeoutSec: Number(e.target.value) })}
            className={`${INPUT_CLASS} w-20`}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        URL
        <input
          value={String(node.data.url ?? "")}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://api.example.com/weather?city={viewer.city}&key={secret:WEATHER_KEY}"
          className={`${INPUT_CLASS} font-mono text-xs`}
        />
      </label>

      <KeyValueEditor
        label="Заголовки"
        values={headers}
        keyPlaceholder="Authorization"
        valuePlaceholder="Bearer {secret:API_KEY}"
        onChange={(v) => onChange({ headers: v })}
      />

      {method !== "GET" && (
        <>
          <label className="flex flex-col gap-1 text-xs">
            Тело запроса
            <select value={bodyType} onChange={(e) => onChange({ bodyType: e.target.value })} className={INPUT_CLASS}>
              <option value="none">Без тела</option>
              <option value="json">JSON</option>
              <option value="form">Форма (x-www-form-urlencoded)</option>
              <option value="text">Текст</option>
            </select>
          </label>
          {(bodyType === "json" || bodyType === "text") && (
            <div className="flex flex-col gap-1 text-xs">
              <div className="h-36 overflow-hidden rounded-lg border border-[var(--border)]">
                <CodeEditor language="js" value={String(node.data.body ?? "")} onChange={(v) => onChange({ body: v })} />
              </div>
              {bodyType === "json" && (
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Плейсхолдеры пишите внутри кавычек: {`{"city": "{viewer.city}"}`} — кавычки и переносы в значениях
                  экранируются автоматически.
                </p>
              )}
            </div>
          )}
          {bodyType === "form" && (
            <KeyValueEditor
              label="Поля формы"
              values={formFields}
              keyPlaceholder="ключ"
              valuePlaceholder="значение"
              onChange={(v) => onChange({ formFields: v })}
            />
          )}
        </>
      )}

      <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
        Ключи API добавьте во вкладке «Бот» → «Секреты» и пишите как {"{secret:ИМЯ}"} — в URL, заголовках и теле. В
        чат секреты не подставляются. Выходы: json (если ответ — JSON), text (тело как есть), status.
      </p>
    </>
  );
}
