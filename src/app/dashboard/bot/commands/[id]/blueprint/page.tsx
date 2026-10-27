import { notFound } from "next/navigation";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { BlueprintEditor } from "@/components/blueprint/BlueprintEditor";
import { emptyGraph, type BpGraph } from "@/lib/blueprint/types";
import { getViewerFields, seedViewerFields } from "@/lib/viewer-data";

export default async function CommandBlueprintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await panelSession();
  if (!session?.user) notFound();

  const command = await prisma.botCommand.findUnique({ where: { id } });
  if (!command || command.userId !== session.user.id) notFound();

  await seedViewerFields(session.user.id);
  const fields = await getViewerFields(session.user.id, false);
  const graph: BpGraph =
    command.mode === "graph" && command.graph ? (command.graph as unknown as BpGraph) : emptyGraph("command");

  return (
    <BlueprintEditor
      title={command.trigger}
      saveUrl={`/api/bot/commands/${command.id}`}
      backHref="/dashboard/bot"
      backLabel="Бот"
      contextKind="command"
      initialGraph={graph}
      viewerFields={fields.map((f) => ({ key: f.key, label: f.label }))}
    />
  );
}
