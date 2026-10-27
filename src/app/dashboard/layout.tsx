import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { getPanel, listSharedPanels } from "@/lib/panel";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { PanelSwitcher } from "@/components/dashboard/PanelSwitcher";
import { DelegationBanner } from "@/components/dashboard/DelegationBanner";
import { UiProvider } from "@/components/ui/UiProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const panel = await getPanel();

  if (!panel) {
    redirect("/");
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  const { actor, owner, delegated } = panel;
  const shared = await listSharedPanels(actor.twitchId);
  const me = { id: actor.id, login: actor.login, displayName: actor.displayName, avatarUrl: actor.avatarUrl };

  return (
    <UiProvider>
      <div className="flex flex-1 bg-background text-foreground">
        <Sidebar onSignOut={handleSignOut} delegated={delegated} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-end gap-3 px-8 py-6">
            <ThemeToggle />
            <PanelSwitcher me={me} current={owner} shared={shared} />
          </header>
          <main className="flex-1 overflow-y-auto px-8 pb-8">
            {delegated && <DelegationBanner ownerName={owner.displayName} ownerLogin={owner.login} />}
            {children}
          </main>
        </div>
      </div>
    </UiProvider>
  );
}
