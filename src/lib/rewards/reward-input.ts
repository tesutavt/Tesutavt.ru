import type { Prisma } from "@prisma/client";

export type RewardInput = Pick<
  Prisma.ChannelRewardUncheckedCreateInput,
  | "title"
  | "cost"
  | "prompt"
  | "backgroundColor"
  | "isEnabled"
  | "isUserInputRequired"
  | "skipQueue"
  | "maxPerStream"
  | "maxPerUserPerStream"
  | "globalCooldownSeconds"
>;

/** Поля, изменение которых нужно отправить на Twitch (graph — только у нас). */
export const TWITCH_REWARD_FIELDS = [
  "title",
  "cost",
  "prompt",
  "backgroundColor",
  "isEnabled",
  "isUserInputRequired",
  "skipQueue",
  "maxPerStream",
  "maxPerUserPerStream",
  "globalCooldownSeconds",
] as const;

function optionalLimit(value: unknown, max: number): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "" || Number(value) <= 0) return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, n) : null;
}

/**
 * Проверяет поля награды по ограничениям Twitch. partial — для PATCH:
 * отсутствующие поля не трогаются.
 */
export function parseRewardInput(
  body: Record<string, unknown>,
  partial: boolean
): { ok: true; data: Partial<RewardInput> } | { ok: false; error: string } {
  const data: Partial<RewardInput> = {};

  if (!partial || "title" in body) {
    const title = String(body.title ?? "").trim();
    if (!title) return { ok: false, error: "Укажите название награды" };
    if (title.length > 45) return { ok: false, error: "Название — не длиннее 45 символов" };
    data.title = title;
  }
  if (!partial || "cost" in body) {
    const cost = Math.round(Number(body.cost));
    if (!Number.isFinite(cost) || cost < 1) return { ok: false, error: "Стоимость — от 1 балла" };
    data.cost = Math.min(cost, 2_000_000_000);
  }
  if ("prompt" in body) {
    const prompt = String(body.prompt ?? "").trim();
    if (prompt.length > 200) return { ok: false, error: "Описание — не длиннее 200 символов" };
    data.prompt = prompt;
  }
  if ("backgroundColor" in body) {
    const color = String(body.backgroundColor ?? "");
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: "Цвет в формате #RRGGBB" };
    data.backgroundColor = color.toUpperCase();
  }
  for (const key of ["isEnabled", "isUserInputRequired", "skipQueue"] as const) {
    if (key in body) data[key] = Boolean(body[key]);
  }

  const maxPerStream = optionalLimit(body.maxPerStream, 1_000_000);
  if (maxPerStream !== undefined) data.maxPerStream = maxPerStream;
  const maxPerUser = optionalLimit(body.maxPerUserPerStream, 1_000_000);
  if (maxPerUser !== undefined) data.maxPerUserPerStream = maxPerUser;
  const cooldown = optionalLimit(body.globalCooldownSeconds, 7 * 24 * 3600);
  if (cooldown !== undefined) data.globalCooldownSeconds = cooldown;

  return { ok: true, data };
}
