import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { MusicTrack } from "@prisma/client";
import { getUserYandexClient } from "@/lib/music/yandex-client";
import type { ResolvedTrack } from "@/lib/music/yandex-client";
import type { ResolvedYouTubeTrack } from "@/lib/music/youtube-client";

export type ResolvedAnyTrack = ResolvedTrack | ResolvedYouTubeTrack;

export interface AddTrackMeta {
  requestedBy: string;
  requestSource: "chat" | "manual" | "reward";
}

export interface MusicState {
  current: MusicTrack | null;
  items: MusicTrack[];
  volume: number;
  maxQueueLength: number;
}

const DEFAULT_VOLUME = 0.8;
const DEFAULT_MAX_QUEUE_LENGTH = 20;

export async function getSettings(userId: string) {
  const settings = await prisma.musicSettings.findUnique({ where: { userId } });
  if (settings) return settings;
  return prisma.musicSettings.upsert({
    where: { userId },
    create: { userId, volume: DEFAULT_VOLUME, maxQueueLength: DEFAULT_MAX_QUEUE_LENGTH },
    update: {},
  });
}

export async function setVolume(userId: string, volume: number) {
  const clamped = Math.min(1, Math.max(0, volume));
  return prisma.musicSettings.upsert({
    where: { userId },
    create: { userId, volume: clamped },
    update: { volume: clamped },
  });
}

export async function getState(userId: string): Promise<MusicState> {
  const [current, items, settings] = await Promise.all([
    prisma.musicTrack.findFirst({ where: { userId, status: "playing" } }),
    prisma.musicTrack.findMany({ where: { userId, status: "queued" }, orderBy: { position: "asc" } }),
    getSettings(userId),
  ]);
  return { current, items, volume: settings.volume, maxQueueLength: settings.maxQueueLength };
}

/** Готовит трек к реальному проигрыванию: тянет свежую ссылку у Яндекса (у YouTube ссылка не нужна — играет IFrame Player). */
async function resolvePlayableFields(userId: string, track: MusicTrack): Promise<Pick<MusicTrack, "streamUrl">> {
  if (track.source !== "yandex") return { streamUrl: null };
  try {
    const client = await getUserYandexClient(userId);
    if (!client) return { streamUrl: null };
    const url = await client.getStreamUrl(track.sourceId);
    return { streamUrl: url };
  } catch {
    return { streamUrl: null };
  }
}

async function promoteNextTrack(userId: string): Promise<MusicTrack | null> {
  const next = await prisma.musicTrack.findFirst({
    where: { userId, status: "queued" },
    orderBy: { position: "asc" },
  });
  if (!next) return null;

  const { streamUrl } = await resolvePlayableFields(userId, next);
  try {
    return await prisma.musicTrack.update({
      where: { id: next.id },
      data: { status: "playing", startedAt: new Date(), currentTimeSec: 0, streamUrl },
    });
  } catch (err) {
    // Гонка: если два запроса почти одновременно решили, что "сейчас
    // ничего не играет" (например, две песни заказали друг за другом
    // почти в один момент — см. addTracks), оба могли независимо выбрать
    // РАЗНЫЕ треки на промоушен. Партиальный уникальный индекс "не больше
    // одного playing на пользователя" (см. миграцию) не даёт создать два
    // одновременно играющих трека — тот, кто пришёл вторым, просто ловит
    // здесь ошибку и отдаёт то, что реально уже играет, вместо падения
    // или порчи очереди. Без этой защиты бывало ровно то, что описал
    // пользователь: несколько заказанных подряд треков проигрывались
    // рвано и очередь "проскакивала" без реального воспроизведения.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.musicTrack.findFirst({ where: { userId, status: "playing" } });
    }
    throw err;
  }
}

export async function addTracks(
  userId: string,
  tracks: ResolvedAnyTrack[],
  meta: AddTrackMeta
): Promise<{ items: MusicTrack[]; current: MusicTrack | null }> {
  if (!tracks.length) return { items: [], current: await prisma.musicTrack.findFirst({ where: { userId, status: "playing" } }) };

  const settings = await getSettings(userId);
  const existingCount = await prisma.musicTrack.count({ where: { userId, status: { in: ["queued", "playing"] } } });
  if (existingCount + tracks.length > settings.maxQueueLength) {
    throw new Error(`Очередь заполнена (свободно ${Math.max(0, settings.maxQueueLength - existingCount)}, нужно ${tracks.length})`);
  }

  const maxPosition = await prisma.musicTrack.aggregate({
    where: { userId, status: "queued" },
    _max: { position: true },
  });
  let position = (maxPosition._max.position ?? 0) + 1;

  const created: MusicTrack[] = [];
  for (const track of tracks) {
    const row = await prisma.musicTrack.create({
      data: {
        userId,
        source: track.source,
        sourceId: track.sourceId,
        title: track.title,
        artist: track.artist,
        cover: track.cover,
        durationMs: track.durationMs,
        requestedBy: meta.requestedBy,
        requestSource: meta.requestSource,
        status: "queued",
        position: position++,
      },
    });
    created.push(row);
  }

  let current = await prisma.musicTrack.findFirst({ where: { userId, status: "playing" } });
  if (!current) {
    current = await promoteNextTrack(userId);
  }

  return { items: created, current };
}

export async function skip(userId: string): Promise<MusicTrack | null> {
  const current = await prisma.musicTrack.findFirst({ where: { userId, status: "playing" } });
  if (current) {
    await prisma.musicTrack.update({ where: { id: current.id }, data: { status: "played" } });
  }
  return promoteNextTrack(userId);
}

export async function onTrackEnded(userId: string, trackId?: string | null): Promise<MusicTrack | null> {
  // Если виджет прислал id трека, который, по его мнению, только что
  // закончился, а по факту сейчас играет уже ДРУГОЙ трек - значит, это
  // устаревший или дублирующий сигнал (например, два открытых экземпляра
  // виджета одновременно, или запрос "ended" пришёл с опозданием уже
  // после ручного skip из дашборда). Пропускаем его - иначе это как раз
  // могло скипать не тот трек и "проскакивать" очередь без проигрыша.
  if (trackId) {
    const current = await prisma.musicTrack.findFirst({ where: { userId, status: "playing" } });
    if (current && current.id !== trackId) {
      return current;
    }
  }
  return skip(userId);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const result = await prisma.musicTrack.deleteMany({ where: { id, userId, status: "queued" } });
  return result.count > 0;
}

export async function clear(userId: string): Promise<void> {
  await prisma.musicTrack.deleteMany({ where: { userId, status: "queued" } });
}

export async function updateProgress(userId: string, trackId: string | null, currentTimeSec: number): Promise<void> {
  const current = await prisma.musicTrack.findFirst({ where: { userId, status: "playing" } });
  if (!current) return;
  // Тот же класс гонки, что и в onTrackEnded: прогресс мог быть отправлен
  // ДО того, как трек сменился (см. /progress POST), а дойти до сервера
  // УЖЕ ПОСЛЕ смены — тогда это устаревшее время старого трека, и без
  // проверки id оно бы записалось поверх currentTimeSec:0 нового трека,
  // из-за чего новый трек стартовал бы с середины/конца и почти сразу
  // "заканчивался" — именно так очередь и проскакивала целиком.
  if (trackId && current.id !== trackId) return;
  await prisma.musicTrack.update({
    where: { id: current.id },
    data: { currentTimeSec: Number.isFinite(currentTimeSec) ? currentTimeSec : 0 },
  });
}

export function formatCurrentTrackText(track: MusicTrack | null): string {
  if (!track) return "Сейчас ничего не играет.";
  return `Сейчас играет: ${track.artist} — ${track.title}`;
}
