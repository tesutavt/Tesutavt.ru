import { Heart, Users, Radio, Bot as BotIcon } from "lucide-react";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { isBotRunning } from "@/lib/bot/manager";
import { getChannelSnapshot } from "@/lib/twitch-channel";
import { BotStatusCard } from "@/components/bot/BotStatusCard";
import { StatTile } from "@/components/dashboard/StatTile";
import { StatsChart } from "@/components/dashboard/StatsChart";
import { QuickSettingsCard } from "@/components/dashboard/QuickSettingsCard";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function DashboardOverviewPage() {
  const session = await panelSession();
  const userId = session!.user.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const [snapshot, botAccount] = await Promise.all([
    user ? getChannelSnapshot(userId, user.twitchId) : null,
    prisma.botAccount.findUnique({ where: { userId } }),
  ]);

  const botLabel = !botAccount ? "Не подключен" : botAccount.enabled ? "Включен" : "Выключен";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader page="dashboard" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Heart}
          value={snapshot?.followerCount ?? "—"}
          label="Фолловеры"
          accent="text-pink-500"
        />
        <StatTile
          icon={Users}
          value={snapshot?.subscriberCount ?? "—"}
          label="Платные подписчики"
          accent="text-violet-500"
        />
        <StatTile
          icon={Radio}
          value={snapshot?.live ? (snapshot.viewerCount ?? 0) : "Офлайн"}
          label={snapshot?.live ? "Зрителей сейчас" : "Статус эфира"}
          accent={snapshot?.live ? "text-emerald-500" : "text-neutral-400"}
        />
        <StatTile icon={BotIcon} value={botLabel} label="Бот" accent="text-sky-500" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <StatsChart />
        <div className="flex flex-col gap-4">
          <BotStatusCard
            status={
              botAccount
                ? {
                    connected: true,
                    botLogin: botAccount.botLogin,
                    botDisplayName: botAccount.botDisplayName,
                    enabled: botAccount.enabled,
                    running: isBotRunning(userId),
                  }
                : { connected: false }
            }
            ownerActions={!session!.panel.delegated}
          />
          <QuickSettingsCard
            initialTitle={snapshot?.title ?? ""}
            initialGame={snapshot?.gameName ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
