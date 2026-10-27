import { prisma } from "@/lib/prisma";

/** overlayToken принадлежит конкретному Widget (холсту), но очередь музыки
 * общая на пользователя — поэтому виджету достаточно знать owner userId. */
export async function resolveOverlayUserId(token: string): Promise<string | null> {
  const widget = await prisma.widget.findUnique({ where: { overlayToken: token }, select: { userId: true } });
  return widget?.userId ?? null;
}
