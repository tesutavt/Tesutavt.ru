import { signIn } from "@/lib/auth";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { Info, ShieldCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Card";
import { buttonClass } from "@/components/ui/Button";
import { hasRewardScopes } from "@/lib/rewards/twitch-rewards";
import { RewardsSection } from "@/components/rewards/RewardsSection";

export default async function RewardsPage() {
  const session = await panelSession();
  const userId = session!.user.id;

  const [rewards, scopesOk, botAccount] = await Promise.all([
    prisma.channelReward.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    hasRewardScopes(userId),
    prisma.botAccount.findUnique({ where: { userId }, select: { enabled: true } }),
  ]);

  return (
    <Page>
      <PageHeader page="rewards" />

      {!scopesOk && (
        <Notice
          tone="warning"
          icon={ShieldCheck}
          title="Нужен доступ к наградам канала"
          action={
            !session!.panel.delegated && (
            <form
              action={async () => {
                "use server";
                await signIn("twitch", { redirectTo: "/dashboard/rewards" });
              }}
            >
              <button type="submit" className={buttonClass("primary", "sm")}>
                Перезайти
              </button>
            </form>
            )
          }
        >
          {session!.panel.delegated
            ? "Владельцу канала нужно перезайти на сайт и разрешить управление наградами за баллы."
            : "Перезайдите на своём аккаунте и разрешите управление наградами за баллы на экране Twitch."}
        </Notice>
      )}

      {!botAccount?.enabled && (
        <Notice icon={Info}>
          Графы наград выполняются, пока включён бот (вкладка «Бот»). Сами награды на Twitch работают и без него.
        </Notice>
      )}

      <RewardsSection
        disabled={!scopesOk}
        initialRewards={rewards.map((r) => ({
          id: r.id,
          twitchRewardId: r.twitchRewardId,
          title: r.title,
          cost: r.cost,
          prompt: r.prompt,
          backgroundColor: r.backgroundColor,
          isEnabled: r.isEnabled,
          isUserInputRequired: r.isUserInputRequired,
          skipQueue: r.skipQueue,
          maxPerStream: r.maxPerStream,
          maxPerUserPerStream: r.maxPerUserPerStream,
          globalCooldownSeconds: r.globalCooldownSeconds,
          lastSyncError: r.lastSyncError,
        }))}
      />
    </Page>
  );
}
