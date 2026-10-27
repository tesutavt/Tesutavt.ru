import { redirect } from "next/navigation";
import { getPanel } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { AccessSection } from "@/components/access/AccessSection";

export default async function AccessPage() {
  const panel = await getPanel();
  // Раздел только для владельца — из чужой панели уводим на её главную.
  if (!panel || panel.delegated) redirect("/dashboard");

  const editors = await prisma.panelAccess.findMany({
    where: { ownerId: panel.userId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <Page>
      <PageHeader page="access" />
      <AccessSection
        initialEditors={editors.map((e) => ({
          id: e.id,
          login: e.editorLogin,
          displayName: e.editorDisplayName,
          avatarUrl: e.editorAvatarUrl,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </Page>
  );
}
