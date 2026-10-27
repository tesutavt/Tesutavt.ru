import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { getState } from "@/lib/music/queue";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Card";
import { Lock } from "lucide-react";
import { YandexConnectSection } from "@/components/music/YandexConnectSection";
import { MusicQueueSection, type MusicTrackView } from "@/components/music/MusicQueueSection";

function toView(track: {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  artist: string;
  cover: string | null;
  durationMs: number;
  requestedBy: string;
  currentTimeSec: number;
} | null): MusicTrackView | null {
  if (!track) return null;
  return {
    id: track.id,
    source: track.source as "yandex" | "youtube",
    sourceId: track.sourceId,
    title: track.title,
    artist: track.artist,
    cover: track.cover,
    durationMs: track.durationMs,
    requestedBy: track.requestedBy,
    currentTimeSec: track.currentTimeSec,
  };
}

export default async function MusicPage() {
  const session = await panelSession();
  const userId = session!.user.id;

  const [yandexAccount, state] = await Promise.all([
    prisma.yandexAccount.findUnique({ where: { userId } }),
    getState(userId),
  ]);

  return (
    <Page>
      <PageHeader page="music" />

      {session!.panel.delegated ? (
        <Notice icon={Lock} title={yandexAccount ? "Яндекс.Музыка подключена" : "Яндекс.Музыка не подключена"}>
          Подключать и отключать Яндекс.Музыку может только владелец канала.
        </Notice>
      ) : (
        <YandexConnectSection connected={Boolean(yandexAccount)} uid={yandexAccount?.uid ?? null} />
      )}

      <MusicQueueSection
        initialCurrent={toView(state.current)}
        initialItems={state.items.map((t) => toView(t)!)}
        initialVolume={state.volume}
        initialMaxQueueLength={state.maxQueueLength}
      />
    </Page>
  );
}
