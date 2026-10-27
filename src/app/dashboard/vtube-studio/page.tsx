import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { VtsConnectSection } from "@/components/vts/VtsConnectSection";
import { Page, PageHeader } from "@/components/ui/PageHeader";

export default async function VtubeStudioPage() {
  const session = await panelSession();
  const userId = session!.user.id;

  const [connection, triggers, legacyBridgeCount] = await Promise.all([
    // upsert — чтобы у пользователя сразу был свой bridgeToken (ссылка для OBS).
    prisma.vtsConnection.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.vtsTrigger.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.widgetElement.count({ where: { presetId: "vtube-studio-bridge", widget: { userId } } }),
  ]);

  return (
    <Page>
      <PageHeader page="vtubeStudio" />

      <VtsConnectSection
        initialConnection={{
          port: connection.port,
          hotkeys: (connection.hotkeys as { hotkeyID: string; name: string; type: string; file?: string }[]) ?? [],
          bridgeToken: connection.bridgeToken,
          bridgeStatus: connection.bridgeStatus,
          lastSeenAt: connection.lastSeenAt?.toISOString() ?? null,
          authorized: Boolean(connection.authToken),
        }}
        initialTriggers={triggers.map((t) => ({
          id: t.id,
          name: t.name,
          hotkeyId: t.hotkeyId,
          hotkeyLabel: t.hotkeyLabel,
        }))}
        legacyBridgeCount={legacyBridgeCount}
        appPort={process.env.APP_PORT ?? "3000"}
      />
    </Page>
  );
}
