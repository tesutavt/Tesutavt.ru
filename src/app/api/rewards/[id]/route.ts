import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";
import { parseRewardInput, TWITCH_REWARD_FIELDS } from "@/lib/rewards/reward-input";
import { deleteRewardOnTwitch, syncRewardToTwitch } from "@/lib/rewards/twitch-rewards";

type RouteParams = { params: Promise<{ id: string }> };

async function ownedReward(id: string, userId: string) {
  const reward = await prisma.channelReward.findUnique({ where: { id } });
  return reward && reward.userId === userId ? reward : null;
}

/**
 * Обновляет настройки и/или граф. На Twitch уходит запрос, только если
 * поменялись поля самой награды (или она ещё не создана там) — автосохранение
 * графа в редакторе Twitch не дёргает. { sync: true } — повторить синхронизацию.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await ownedReward(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = parseRewardInput(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const graphNodes = (body.graph as { nodes?: { data?: unknown }[] } | undefined)?.nodes ?? [];
  const banned = checkBannedWords([parsed.data.title, parsed.data.prompt, graphNodes.map((n) => n.data)]);
  if (banned) return banned;

  const reward = await prisma.channelReward.update({
    where: { id },
    data: { ...parsed.data, ...(body.graph ? { graph: body.graph } : {}) },
  });

  const twitchFieldsChanged = TWITCH_REWARD_FIELDS.some((f) => f in parsed.data);
  if (twitchFieldsChanged || body.sync === true || (!reward.twitchRewardId && !body.graph)) {
    return NextResponse.json(await syncRewardToTwitch(reward));
  }
  return NextResponse.json(reward);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await ownedReward(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteRewardOnTwitch(existing);
  await prisma.channelReward.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
