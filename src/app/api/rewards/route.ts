import { NextRequest, NextResponse } from "next/server";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { checkBannedWords } from "@/lib/moderation/api";
import { parseRewardInput, type RewardInput } from "@/lib/rewards/reward-input";
import { syncRewardToTwitch } from "@/lib/rewards/twitch-rewards";
import { emptyGraph } from "@/lib/blueprint/types";
import { ensureRewardListener } from "@/lib/bot/manager";

export async function GET() {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rewards = await prisma.channelReward.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rewards);
}

/** Создаёт награду у нас и сразу на Twitch. */
export async function POST(req: NextRequest) {
  const session = await panelSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = parseRewardInput(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const banned = checkBannedWords([parsed.data.title, parsed.data.prompt]);
  if (banned) return banned;

  const reward = await prisma.channelReward.create({
    data: {
      userId: session.user.id,
      ...(parsed.data as RewardInput),
      graph: emptyGraph("reward") as never,
    },
  });
  const synced = await syncRewardToTwitch(reward);
  void ensureRewardListener(session.user.id).catch(() => {});

  return NextResponse.json(synced, { status: 201 });
}
