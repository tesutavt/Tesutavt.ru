"use client";

import type { WidgetFieldSchema, WidgetFieldType } from "@/lib/widget-types";

const FIELD_TYPES: WidgetFieldType[] = [
  "text",
  "number",
  "color",
  "boolean",
  "image",
  "font",
  "select",
];

function defaultForType(type: WidgetFieldType): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "color":
      return "#ffffff";
    case "select":
      return "";
    default:
      return "";
  }
}

interface FieldsPanelProps {
  fields: WidgetFieldSchema[];
  values: Record<string, unknown>;
  onChange: (fields: WidgetFieldSchema[], values: Record<string, unknown>) => void;
}

export function FieldsPanel({ fields, values, onChange }: FieldsPanelProps) {
  function addField() {
    const key = `field${fields.length + 1}`;
    const newField: WidgetFieldSchema = {
      key,
      label: "Новое поле",
      type: "text",
      default: "",
    };
    onChange([...fields, newField], { ...values, [key]: newField.default });
  }

  function updateField(index: number, patch: Partial<WidgetFieldSchema>) {
    const oldField = fields[index];
    const nextField = { ...oldField, ...patch };

    if (patch.type && patch.type !== oldField.type) {
      nextField.default = defaultForType(patch.type);
    }

    const nextFields = fields.map((f, i) => (i === index ? nextField : f));

    let nextValues = values;
    if (patch.key && patch.key !== oldField.key) {
      const { [oldField.key]: oldValue, ...rest } = values;
      nextValues = { ...rest, [patch.key]: oldValue ?? nextField.default };
    } else if (patch.default !== undefined) {
      nextValues = { ...values, [nextField.key]: patch.default };
    }

    onChange(nextFields, nextValues);
  }

  function removeField(index: number) {
    const field = fields[index];
    const nextFields = fields.filter((_, i) => i !== index);
    const nextValues = { ...values };
    delete nextValues[field.key];
    onChange(nextFields, nextValues);
  }

  function updateValue(key: string, value: unknown) {
    onChange(fields, { ...values, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      {fields.length === 0 && (
        <p className="text-sm text-neutral-500">
          Полей пока нет. Добавьте поле, чтобы сделать виджет настраиваемым —
          значения будут доступны в JS как <code>window.widget.fields</code>.
        </p>
      )}

      {fields.map((field, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3"
        >
          <div className="flex gap-2">
            <input
              value={field.key}
              onChange={(e) => updateField(index, { key: e.target.value })}
              placeholder="key"
              className="w-1/3 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white"
            />
            <input
              value={field.label}
              onChange={(e) => updateField(index, { label: e.target.value })}
              placeholder="Название поля"
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white"
            />
            <select
              value={field.type}
              onChange={(e) =>
                updateField(index, { type: e.target.value as WidgetFieldType })
              }
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => removeField(index)}
              className="rounded border border-red-900 px-2 text-sm text-red-400 hover:bg-red-950"
            >
              ×
            </button>
          </div>

          {field.type === "select" && (
            <input
              value={field.options?.join(", ") ?? ""}
              onChange={(e) =>
                updateField(index, {
                  options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="Варианты через запятую"
              className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white"
            />
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Значение:</span>
            <FieldValueInput field={field} value={values[field.key]} onChange={(v) => updateValue(field.key, v)} />
          </div>
        </div>
      ))}

      <button
        onClick={addField}
        className="rounded-md border border-dashed border-neutral-700 py-2 text-sm text-neutral-400 hover:border-[#9146FF] hover:text-neutral-200"
      >
        + Добавить поле
      </button>
    </div>
  );
}

function FieldValueInput({
  field,
  value,
  onChange,
}: {
  field: WidgetFieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        value={Number(value ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white"
      />
    );
  }
  if (field.type === "color") {
    return (
      <input
        type="color"
        value={String(value ?? "#ffffff")}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-14 rounded border border-neutral-700 bg-neutral-800"
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white"
      >
        <option value="">—</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white"
    />
  );
}
