import YouTubeClient from "@/lib/music/youtube-client";
import { getUserYandexClient } from "@/lib/music/yandex-client";
import { addTracks, type AddTrackMeta, type ResolvedAnyTrack } from "@/lib/music/queue";
import type { MusicTrack } from "@prisma/client";

const youtubeClient = new YouTubeClient();

export interface SongRequestResult {
  ok: boolean;
  reason?: "not_found" | "error" | "yandex_not_connected";
  error?: string;
  track?: MusicTrack;
  tracks?: MusicTrack[];
}

/** Общая точка входа для запроса музыки — используется и командой чата !song, и ручным добавлением из дашборда. */
export async function requestSong(userId: string, query: string, meta: AddTrackMeta): Promise<SongRequestResult> {
  try {
    let tracks: ResolvedAnyTrack[] | null = await youtubeClient.resolveMany(query);

    if (!tracks) {
      const yandexClient = await getUserYandexClient(userId);
      if (!yandexClient) {
        return { ok: false, reason: "yandex_not_connected", error: "Яндекс.Музыка не подключена, а ссылка не похожа на YouTube." };
      }
      tracks = await yandexClient.resolveMany(query);
    }

    if (!tracks?.length) {
      return { ok: false, reason: "not_found" };
    }

    const { items } = await addTracks(userId, tracks, meta);
    return { ok: true, tracks: items, track: items[0] };
  } catch (err) {
    return { ok: false, reason: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
