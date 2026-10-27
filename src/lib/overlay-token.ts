import { prisma } from "@/lib/prisma";

/** overlayToken принадлежит конкретному Widget (холсту), но всё, что с ним
 * связано на сервере (очередь музыки, live-события бота), общее на
 * пользователя — так что публичным эндпоинтам достаточно знать owner userId. */
export async function resolveOverlayUserId(token: string): Promise<string | null> {
  const widget = await prisma.widget.findUnique({ where: { overlayToken: token }, select: { userId: true } });
  return widget?.userId ?? null;
}

/** Для VTS-эндпоинтов: принимает и bridgeToken страницы-моста /vts/[token],
 * и overlayToken любого холста (старые ссылки и tools/vts-relay.js). */
export async function resolveVtsUserId(token: string): Promise<string | null> {
  const connection = await prisma.vtsConnection.findUnique({ where: { bridgeToken: token }, select: { userId: true } });
  return connection?.userId ?? (await resolveOverlayUserId(token));
}
