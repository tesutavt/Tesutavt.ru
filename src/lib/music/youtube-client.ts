const VIDEO_ID_RE =
  /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#&]*&)?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i;

export interface ResolvedYouTubeTrack {
  source: "youtube";
  sourceId: string;
  title: string;
  artist: string;
  cover: string | null;
  durationMs: number;
  sourceUrl: string;
}

// YouTube проигрывается официальным IFrame Player API прямо в виджете.
// Этот клиент только распознаёт ссылки и получает метаданные для карточки —
// сам видеопоток он никогда не скачивает.
export default class YouTubeClient {
  static extractVideoId(input: string): string | null {
    const match = input.trim().match(VIDEO_ID_RE);
    return match?.[1] || null;
  }

  async resolveMany(query: string): Promise<ResolvedYouTubeTrack[] | null> {
    const videoId = YouTubeClient.extractVideoId(query);
    if (!videoId) return null;

    let title = "YouTube";
    let artist = "YouTube";
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
      if (response.ok) {
        const metadata = (await response.json()) as { title?: string; author_name?: string };
        title = metadata.title || title;
        artist = metadata.author_name || artist;
      }
    } catch {
      // Воспроизведение всё равно продолжится, если метаданные временно недоступны.
    }

    return [
      {
        source: "youtube",
        sourceId: videoId,
        title,
        artist,
        cover: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationMs: 0,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      },
    ];
  }
}
