import { notFound } from "next/navigation";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { BlueprintEditor } from "@/components/blueprint/BlueprintEditor";
import { emptyGraph, type BpGraph } from "@/lib/blueprint/types";
import { getViewerFields, seedViewerFields } from "@/lib/viewer-data";

export default async function RewardBlueprintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await panelSession();
  if (!session?.user) notFound();

  const reward = await prisma.channelReward.findUnique({ where: { id } });
  if (!reward || reward.userId !== session.user.id) notFound();

  await seedViewerFields(session.user.id);
  const fields = await getViewerFields(session.user.id, false);
  const graph: BpGraph = reward.graph ? (reward.graph as unknown as BpGraph) : emptyGraph("reward");

  return (
    <BlueprintEditor
      title={reward.title}
      saveUrl={`/api/rewards/${reward.id}`}
      backHref="/dashboard/rewards"
      backLabel="Награды"
      contextKind="reward"
      initialGraph={graph}
      viewerFields={fields.map((f) => ({ key: f.key, label: f.label }))}
    />
  );
}
