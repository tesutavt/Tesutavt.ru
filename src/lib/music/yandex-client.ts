import { YMApi, WrappedYMApi } from "ym-api-meowed";
import { prisma } from "@/lib/prisma";

const TRACK_ID_RE = /track\/(\d+)/;
const ALBUM_ID_RE = /album\/(\d+)/;
const PLAYLIST_RE = /users\/([^/]+)\/playlists\/(\d+)/;
const LIKES_RE = /users\/([^/]+)\/likes\/tracks?/;

export interface ResolvedTrack {
  source: "yandex";
  sourceId: string;
  title: string;
  artist: string;
  cover: string | null;
  durationMs: number;
  sourceUrl: string;
}

/**
 * Обёртка над ym-api-meowed: поиск трека по тексту, разбор ссылки на трек
 * вида music.yandex.ru/track/12345 (или .../album/1/track/12345, плейлист,
 * "мне нравится") и получение прямой ссылки на mp3 для проигрывания в
 * виджете. Один экземпляр создаётся на запрос — состояние (токен/uid)
 * передаётся явно, т.к. в серверлесс-окружении Next.js процесс не живёт
 * между запросами.
 */
export default class YandexMusicClient {
  private api = new YMApi();
  private wrapped = new WrappedYMApi(this.api);
  ready = false;

  async getAccountStatus() {
    return this.api.getAccountStatus();
  }

  async init(accessToken: string, uid: number) {
    if (uid) {
      // init() у ym-api-meowed проваливается в проверку по логину/паролю,
      // если uid ложный (0/undefined) — токена одного достаточно почти для
      // всего, поэтому идём через init() только когда uid уже известен.
      await this.api.init({ access_token: accessToken, uid });
    } else {
      // @ts-expect-error приватное поле — так же делает оригинальный клиент
      this.api.user.token = accessToken;
      // @ts-expect-error приватное поле — так же делает оригинальный клиент
      this.api.user.uid = 0;
    }
    this.ready = true;
  }

  static extractTrackId(input: string): string | null {
    const s = input.trim();
    if (/^\d+$/.test(s)) return s;
    const m = s.match(TRACK_ID_RE);
    return m ? m[1] : null;
  }

  static extractCollection(input: string) {
    const s = input.trim();
    const playlist = s.match(PLAYLIST_RE);
    if (playlist) return { type: "playlist" as const, user: decodeURIComponent(playlist[1]), id: playlist[2] };
    const likes = s.match(LIKES_RE);
    if (likes) return { type: "likes" as const, user: decodeURIComponent(likes[1]) };
    const album = s.match(ALBUM_ID_RE);
    if (album && !TRACK_ID_RE.test(s)) return { type: "album" as const, id: album[1] };
    return null;
  }

  static looksLikeUrlOrId(input: string): boolean {
    const s = input.trim();
    return /^\d+$/.test(s) || /music\.yandex\./i.test(s) || /^https?:\/\//i.test(s);
  }

  async resolveMany(query: string): Promise<ResolvedTrack[] | null> {
    if (!this.ready) throw new Error("Яндекс Музыка не авторизована");

    let trackId: string | null = null;
    if (YandexMusicClient.looksLikeUrlOrId(query)) {
      trackId = YandexMusicClient.extractTrackId(query);
      if (trackId) {
        const track = await this.resolveTrack(trackId);
        return track ? [track] : [];
      }

      const collection = YandexMusicClient.extractCollection(query);
      if (collection?.type === "album") return this.resolveAlbum(collection.id);
      if (collection?.type === "playlist") return this.resolvePlaylist(collection.id, collection.user);
      if (collection?.type === "likes") return this.resolveLikedTracks(collection.user);

      throw new Error("Не удалось распознать ссылку Яндекс Музыки");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await this.api.searchTracks(query);
    const results = res?.tracks?.results || [];
    if (!results.length) return null;
    trackId = String(results[0].id);

    const track = await this.resolveTrack(trackId);
    return track ? [track] : [];
  }

  async resolveTrack(trackId: string): Promise<ResolvedTrack | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trackArr: any = await this.api.getTrack(trackId as unknown as number);
    const track = Array.isArray(trackArr) ? trackArr[0] : trackArr;
    if (!track) return null;
    return this.formatTrack(track, trackId);
  }

  async resolveAlbum(albumId: string): Promise<ResolvedTrack[]> {
    const album = await this.api.getAlbumWithTracks(Number(albumId));
    const tracks = (album?.volumes || []).flat();
    if (!tracks.length) return [];
    return tracks.map((track) => this.formatTrack(track, String(track.id))!).filter(Boolean);
  }

  async resolvePlaylist(playlistId: string, user: string): Promise<ResolvedTrack[]> {
    const playlists = await this.api.getPlaylists([Number(playlistId)], user, { "rich-tracks": true });
    const playlist = playlists?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks = ((playlist?.tracks || []) as any[]).map((item) => item.track).filter(Boolean);
    if (!tracks.length) return [];
    return tracks.map((track) => this.formatTrack(track, String(track.id))!).filter(Boolean);
  }

  async resolveLikedTracks(user: string): Promise<ResolvedTrack[]> {
    const liked = await this.api.getLikedTracks(user);
    const ids = (liked?.library?.tracks || []).map((track) => track.id).filter(Boolean);
    if (!ids.length) return [];
    const tracks = await Promise.all(ids.map((id) => this.resolveTrack(String(id))));
    return tracks.filter((t): t is ResolvedTrack => Boolean(t));
  }

  /** Ссылки на mp3 у Яндекса протухают — получаем свежую перед стартом трека. */
  async getStreamUrl(trackId: string): Promise<string> {
    return this.wrapped.getMp3DownloadUrl(Number(trackId));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatTrack(track: any, trackId: string): ResolvedTrack | null {
    if (!track) return null;

    const id = String(trackId || track.id);
    const albumId = track.albums?.[0]?.id;

    return {
      source: "yandex",
      sourceId: id,
      title: track.title,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      artist: (track.artists || []).map((a: any) => a.name).join(", "),
      cover: track.coverUri ? `https://${track.coverUri.replace("%%", "400x400")}` : null,
      durationMs: track.durationMs ?? 0,
      sourceUrl: albumId
        ? `https://music.yandex.ru/album/${albumId}/track/${id}`
        : `https://music.yandex.ru/track/${id}`,
    };
  }
}

/** Проверяет токен (для UI подключения) и возвращает numeric uid аккаунта. */
export async function fetchYandexUid(accessToken: string): Promise<number> {
  const client = new YandexMusicClient();
  await client.init(accessToken, 0);
  const status = await client.getAccountStatus();
  return status?.account?.uid ?? 0;
}

/** Собирает авторизованный клиент по сохранённому в БД токену пользователя. */
export async function getUserYandexClient(userId: string): Promise<YandexMusicClient | null> {
  const account = await prisma.yandexAccount.findUnique({ where: { userId } });
  if (!account) return null;
  const client = new YandexMusicClient();
  await client.init(account.accessToken, account.uid);
  return client;
}
