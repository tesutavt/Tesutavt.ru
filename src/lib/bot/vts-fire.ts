import { prisma } from "@/lib/prisma";
import { publishOverlayEvent } from "@/lib/bot/event-bus";

export async function fireVtsTrigger(
  userId: string,
  ref: { name?: string; hotkeyId?: string }
): Promise<{ ok: boolean; error?: string }> {
  let hotkeyId = ref.hotkeyId ?? null;

  if (!hotkeyId && ref.name) {
    const trigger = await prisma.vtsTrigger.findUnique({
      where: { userId_name: { userId, name: ref.name.trim().toLowerCase() } },
    });
    if (!trigger) return { ok: false, error: `Триггер "${ref.name}" не найден` };
    hotkeyId = trigger.hotkeyId;
  }

  if (!hotkeyId) return { ok: false, error: "Не указан name или hotkeyId" };

  publishOverlayEvent(userId, "vtsTrigger", { hotkeyId });
  return { ok: true };
}
