import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { isBotRunning } from "@/lib/bot/manager";
import { seedStandardCommands } from "@/lib/bot/standard-commands";
import { BotStatusCard } from "@/components/bot/BotStatusCard";
import { CommandsSection } from "@/components/bot/CommandsSection";
import { TimersSection } from "@/components/bot/TimersSection";
import { ChannelBotScopeBanner } from "@/components/bot/ChannelBotScopeBanner";
import { SecretsSection } from "@/components/bot/SecretsSection";
import { maskSecret } from "@/lib/bot/secrets";
import { Page, PageHeader } from "@/components/ui/PageHeader";

export default async function BotPage() {
  const session = await panelSession();
  const userId = session!.user.id;
  // Редактор чужой панели: без привязки/отвязки бота и без секретов владельца.
  const delegated = session!.panel.delegated;

  const existingBotAccount = await prisma.botAccount.findUnique({ where: { userId } });
  if (existingBotAccount) {
    // Идемпотентно: подтягивает новые встроенные команды (например !song)
    // для стримеров, которые подключили бота раньше, чем эти команды появились.
    await seedStandardCommands(userId);
  }

  const [botAccount, commands, timers, broadcasterAccount, secrets] = await Promise.all([
    prisma.botAccount.findUnique({ where: { userId } }),
    prisma.botCommand.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.botTimer.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.account.findFirst({ where: { userId, provider: "twitch" } }),
    delegated ? [] : prisma.botSecret.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  const hasChannelBotScope = Boolean(broadcasterAccount?.scope?.includes("channel:bot"));

  return (
    <Page>
      <PageHeader page="bot" />
      <div className="flex flex-col gap-3">
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
          ownerActions={!delegated}
        />
        {botAccount && !hasChannelBotScope && <ChannelBotScopeBanner />}
      </div>

      {botAccount && (
        <>
          <CommandsSection
            initialCommands={commands.map((c) => ({
              id: c.id,
              trigger: c.trigger,
              standardKey: c.standardKey,
              response: c.response,
              mode: c.mode,
              userLevel: c.userLevel,
              cooldownSeconds: c.cooldownSeconds,
              enabled: c.enabled,
            }))}
          />
          <TimersSection
            initialTimers={timers.map((t) => ({
              id: t.id,
              messages: t.messages,
              intervalSeconds: t.intervalSeconds,
              minMessages: t.minMessages,
              enabled: t.enabled,
            }))}
          />
          <SecretsSection
            readOnly={delegated}
            initialSecrets={secrets.map((s) => ({ id: s.id, name: s.name, masked: maskSecret(s.value) }))}
          />
        </>
      )}
    </Page>
  );
}
