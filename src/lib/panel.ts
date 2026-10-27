import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Cookie с id владельца панели, которую сейчас редактирует пользователь. */
export const PANEL_COOKIE = "vo_panel";

export interface PanelOwner {
  id: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PanelContext {
  /** Чьи данные читаем и меняем: свой id или id владельца чужой панели. */
  userId: string;
  /** Кто реально вошёл на сайт. */
  actor: { id: string; twitchId: string; login: string; displayName: string; avatarUrl: string | null };
  /** true — пользователь работает в чужой панели как редактор. */
  delegated: boolean;
  owner: PanelOwner;
}

/**
 * Определяет, чью панель сейчас открыл пользователь. Чужая панель — только
 * если владелец выдал доступ его Twitch-аккаунту (PanelAccess); иначе (доступ
 * отозвали, cookie подделан) — молча своя.
 */
export const getPanel = cache(async (): Promise<PanelContext | null> => {
  const session = await auth();
  if (!session?.user) return null;
  const actor = session.user;
  const self: PanelOwner = {
    id: actor.id,
    login: actor.login,
    displayName: actor.displayName,
    avatarUrl: actor.avatarUrl,
  };

  const requested = (await cookies()).get(PANEL_COOKIE)?.value;
  if (requested && requested !== actor.id && actor.twitchId) {
    const access = await prisma.panelAccess.findUnique({
      where: { ownerId_editorTwitchId: { ownerId: requested, editorTwitchId: actor.twitchId } },
      include: { owner: { select: { id: true, login: true, displayName: true, avatarUrl: true } } },
    });
    if (access) {
      return { userId: access.owner.id, actor, delegated: true, owner: access.owner };
    }
  }
  return { userId: actor.id, actor, delegated: false, owner: self };
});

/**
 * Замена auth() для данных панели: session.user.id — id владельца текущей
 * панели (своей или чужой). Для действий только владельца (подключение
 * бота, токены, выдача доступа) по-прежнему используется auth().
 */
export async function panelSession() {
  const panel = await getPanel();
  if (!panel) return null;
  return { user: { ...panel.actor, id: panel.userId }, panel };
}

export const OWNER_ONLY_ERROR = "Это может сделать только владелец канала";

/**
 * Для действий только владельца: в чужой панели возвращает null вместе с
 * причиной, чтобы маршрут ответил 403, а не тронул аккаунт самого редактора.
 */
export async function ownerSession() {
  const session = await panelSession();
  if (!session) return { session: null, forbidden: false } as const;
  if (session.panel.delegated) return { session: null, forbidden: true } as const;
  return { session, forbidden: false } as const;
}

/** Панели, к которым у пользователя есть доступ (кроме своей). */
export async function listSharedPanels(actorTwitchId: string): Promise<PanelOwner[]> {
  if (!actorTwitchId) return [];
  const accesses = await prisma.panelAccess.findMany({
    where: { editorTwitchId: actorTwitchId },
    include: { owner: { select: { id: true, login: true, displayName: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return accesses.map((a) => a.owner);
}
