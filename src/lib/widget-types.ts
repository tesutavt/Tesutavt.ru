export type WidgetFieldType =
  | "text"
  | "number"
  | "color"
  | "boolean"
  | "image"
  | "font"
  | "select";

export interface WidgetFieldSchema {
  key: string;
  label: string;
  type: WidgetFieldType;
  default: unknown;
  options?: string[];
}

export interface WidgetPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  html: string;
  css: string;
  js: string;
  fieldsSchema: WidgetFieldSchema[];
  /** Не показывать в меню добавления (оставлен только для старых холстов). */
  hidden?: boolean;
}

export function defaultFieldValues(fields: WidgetFieldSchema[]): Record<string, unknown> {
  return fields.reduce<Record<string, unknown>>((acc, field) => {
    acc[field.key] = field.default;
    return acc;
  }, {});
}
