import type { ViewerField, ViewerFieldType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { containsBannedWord, BANNED_WORD_ERROR } from "@/lib/moderation/banned-words";

/** Поля, которые появляются у стримера автоматически (можно отключить/удалить). */
export const DEFAULT_VIEWER_FIELDS: {
  key: string;
  label: string;
  type: ViewerFieldType;
  aliases: string[];
  maxLength: number;
}[] = [
  { key: "city", label: "Город", type: "text", aliases: ["город"], maxLength: 60 },
  { key: "birthday", label: "День рождения", type: "date", aliases: ["date", "др", "дата", "birth"], maxLength: 10 },
  { key: "name", label: "Имя", type: "text", aliases: ["имя"], maxLength: 40 },
  { key: "game", label: "Любимая игра", type: "text", aliases: ["игра"], maxLength: 80 },
  { key: "timezone", label: "Часовой пояс", type: "text", aliases: ["tz", "пояс"], maxLength: 20 },
];

export const VIEWER_KEY_RE = /^[a-z][a-z0-9_]{0,29}$/;
export const VIEWER_FIELD_TYPES: ViewerFieldType[] = ["text", "number", "date"];

/** Алиасы для !set: без пробелов, в нижнем регистре, без повторов. */
export function sanitizeAliases(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const list = input.map((a) => String(a).trim().toLowerCase()).filter((a) => a && !/\s/.test(a));
  return [...new Set(list)].slice(0, 10);
}

/** Один раз создаёт поля по умолчанию; потом стример управляет ими сам. */
export async function seedViewerFields(userId: string) {
  const count = await prisma.viewerField.count({ where: { userId } });
  if (count > 0) return;
  await prisma.viewerField.createMany({
    data: DEFAULT_VIEWER_FIELDS.map((f) => ({ userId, ...f })),
    skipDuplicates: true,
  });
}

export async function getViewerFields(userId: string, onlyEnabled = true) {
  return prisma.viewerField.findMany({
    where: { userId, ...(onlyEnabled ? { enabled: true } : {}) },
    orderBy: { createdAt: "asc" },
  });
}

export function findField(fields: ViewerField[], name: string): ViewerField | undefined {
  const n = name.trim().toLowerCase();
  return fields.find((f) => f.key === n || f.aliases.some((a) => a.toLowerCase() === n));
}

/**
 * Приводит значение к формату поля. Дата принимается как 15/02/2003,
 * 15.02.2003, 15-02-2003, 2003-02-15 или без года (15.02), хранится как
 * "15.02.2003" / "15.02".
 */
export function normalizeViewerValue(
  field: Pick<ViewerField, "type" | "maxLength" | "label">,
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: `Укажите значение для «${field.label}»` };
  if (containsBannedWord(text)) return { ok: false, error: BANNED_WORD_ERROR };

  if (field.type === "number") {
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n)) return { ok: false, error: `«${field.label}» должно быть числом` };
    return { ok: true, value: String(n) };
  }

  if (field.type === "date") {
    let d: number, m: number, y: number | null;
    const iso = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    const dmy = text.match(/^(\d{1,2})[-./](\d{1,2})(?:[-./](\d{2}|\d{4}))?$/);
    if (iso) {
      [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    } else if (dmy) {
      d = Number(dmy[1]);
      m = Number(dmy[2]);
      y = dmy[3] ? Number(dmy[3]) : null;
      if (y !== null && y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
    } else {
      return { ok: false, error: `Дата в формате ДД.ММ.ГГГГ, например 15.02.2003` };
    }
    const check = new Date(Date.UTC(y ?? 2000, m - 1, d));
    const valid = check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
    const currentYear = new Date().getFullYear();
    if (!valid || (y !== null && (y < 1900 || y > currentYear))) {
      return { ok: false, error: "Такой даты не существует" };
    }
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return { ok: true, value: y !== null ? `${dd}.${mm}.${y}` : `${dd}.${mm}` };
  }

  return { ok: true, value: text.slice(0, Math.max(1, field.maxLength)) };
}

export interface ViewerRef {
  twitchId: string;
  login: string;
  name: string;
}

export async function setViewerValue(
  userId: string,
  viewer: ViewerRef,
  fieldName: string,
  rawValue: string
): Promise<{ ok: true; field: ViewerField; value: string } | { ok: false; error: string }> {
  const fields = await getViewerFields(userId);
  const field = findField(fields, fieldName);
  if (!field) {
    return { ok: false, error: `Нет поля «${fieldName}». Доступно: ${fields.map((f) => f.key).join(", ") || "—"}` };
  }
  const normalized = normalizeViewerValue(field, rawValue);
  if (!normalized.ok) return normalized;

  await prisma.viewerData.upsert({
    where: { userId_viewerTwitchId_key: { userId, viewerTwitchId: viewer.twitchId, key: field.key } },
    create: {
      userId,
      viewerTwitchId: viewer.twitchId,
      viewerLogin: viewer.login.toLowerCase(),
      viewerName: viewer.name,
      key: field.key,
      value: normalized.value,
    },
    update: { value: normalized.value, viewerLogin: viewer.login.toLowerCase(), viewerName: viewer.name },
  });
  return { ok: true, field, value: normalized.value };
}

export async function unsetViewerValue(userId: string, viewerTwitchId: string, fieldName: string) {
  const field = findField(await getViewerFields(userId, false), fieldName);
  if (!field) return null;
  await prisma.viewerData.deleteMany({ where: { userId, viewerTwitchId, key: field.key } });
  return field;
}

/** Все значения зрителя: по twitchId (сам вызвавший) или по нику (@nick). */
export async function getViewerValues(
  userId: string,
  who: { twitchId?: string; login?: string }
): Promise<Record<string, string>> {
  const login = who.login?.replace(/^@/, "").toLowerCase();
  if (!who.twitchId && !login) return {};
  const rows = await prisma.viewerData.findMany({
    where: { userId, ...(who.twitchId ? { viewerTwitchId: who.twitchId } : { viewerLogin: login }) },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Подставляет {viewer.key} — данные того, кто вызвал команду. */
export async function interpolateViewerVars(userId: string, viewerTwitchId: string, text: string): Promise<string> {
  if (!/\{viewer\.[a-z0-9_]+\}/i.test(text)) return text;
  const values = await getViewerValues(userId, { twitchId: viewerTwitchId });
  return text.replace(/\{viewer\.([a-z0-9_]+)\}/gi, (_, key: string) => values[key.toLowerCase()] ?? "");
}

// --- Встроенные команды ---

export async function runSetCommand(userId: string, viewer: ViewerRef, argsText: string): Promise<string> {
  const [fieldName, ...rest] = argsText.trim().split(/\s+/);
  if (!fieldName) {
    const fields = await getViewerFields(userId);
    if (!fields.length) return "Стример пока не включил ни одного поля.";
    return `Можно запомнить: ${fields.map((f) => `${f.key} (${f.label})`).join(", ")}. Пример: !set ${fields[0].key} значение`;
  }
  const result = await setViewerValue(userId, viewer, fieldName, rest.join(" "));
  if (!result.ok) return result.error;
  return `Запомнил: ${result.field.label.toLowerCase()} — ${result.value}`;
}

export async function runGetCommand(userId: string, viewer: ViewerRef, argsText: string): Promise<string> {
  const parts = argsText.trim().split(/\s+/).filter(Boolean);
  const target = parts.find((p) => p.startsWith("@"));
  const fieldName = parts.find((p) => !p.startsWith("@"));
  const fields = await getViewerFields(userId);
  const values = await getViewerValues(userId, target ? { login: target } : { twitchId: viewer.twitchId });
  const whose = target ? target.replace(/^@/, "") : viewer.name;

  if (fieldName) {
    const field = findField(fields, fieldName);
    if (!field) return `Нет поля «${fieldName}».`;
    const value = values[field.key];
    return value ? `${whose}: ${field.label.toLowerCase()} — ${value}` : `${whose} ещё не указал(а) ${field.label.toLowerCase()}.`;
  }

  const filled = fields.filter((f) => values[f.key]);
  if (!filled.length) return target ? `Про ${whose} ничего не известно.` : "Вы ещё ничего не рассказали о себе. Попробуйте !set";
  return `${whose}: ${filled.map((f) => `${f.label.toLowerCase()} — ${values[f.key]}`).join(", ")}`;
}

export async function runUnsetCommand(userId: string, viewer: ViewerRef, argsText: string): Promise<string> {
  const fieldName = argsText.trim().split(/\s+/)[0];
  if (!fieldName) return "Укажите, что забыть: !unset поле";
  const field = await unsetViewerValue(userId, viewer.twitchId, fieldName);
  return field ? `Забыл: ${field.label.toLowerCase()}` : `Нет поля «${fieldName}».`;
}
