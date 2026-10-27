import { prisma } from "@/lib/prisma";

export const SECRET_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/** Секреты пользователя для {secret:NAME} в HTTP-блоке блюпринтов. */
export async function getUserSecrets(userId: string): Promise<Record<string, string>> {
  const rows = await prisma.botSecret.findMany({ where: { userId } });
  return Object.fromEntries(rows.map((r) => [r.name, r.value]));
}

/** "sk-abc…xyz" — чтобы в интерфейсе было видно, какой ключ сохранён, не раскрывая его. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 3)}…${value.slice(-3)}`;
}
