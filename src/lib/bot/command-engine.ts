import type { CommandUserLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendChatMessage } from "@/lib/bot/chat";
import { runStandardCommand } from "@/lib/bot/standard-commands";
import { runBlueprint } from "@/lib/blueprint/execute";
import type { BpGraph } from "@/lib/blueprint/types";
import { interpolateViewerVars } from "@/lib/viewer-data";

export interface IncomingChatMessage {
  messageId: string;
  chatterId: string;
  chatterLogin: string;
  chatterName: string;
  text: string;
  badgeSetIds: Set<string>;
  color?: string | null;
}

function hasPermission(userLevel: CommandUserLevel, msg: IncomingChatMessage, broadcasterTwitchId: string) {
  const badges = msg.badgeSetIds;
  const isBroadcaster = msg.chatterId === broadcasterTwitchId || badges.has("broadcaster");
  const isModerator = isBroadcaster || badges.has("moderator");
  const isVip = isModerator || badges.has("vip");
  const isSubscriber = isModerator || badges.has("subscriber");

  switch (userLevel) {
    case "everyone":
      return true;
    case "subscriber":
      return isSubscriber;
    case "vip":
      return isVip;
    case "moderator":
      return isModerator;
    case "broadcaster":
      return isBroadcaster;
    default:
      return false;
  }
}

export async function handleChatMessage(
  userId: string,
  broadcasterTwitchId: string,
  botTwitchId: string,
  botAccessToken: string,
  msg: IncomingChatMessage
) {
  const trimmed = msg.text.trim();
  if (!trimmed.startsWith("!")) return;

  const [trigger, ...rest] = trimmed.split(/\s+/);
  const argsText = rest.join(" ");

  const command = await prisma.botCommand.findUnique({
    where: { userId_trigger: { userId, trigger: trigger.toLowerCase() } },
  });
  if (!command || !command.enabled) return;

  if (!hasPermission(command.userLevel, msg, broadcasterTwitchId)) return;

  if (command.lastTriggeredAt) {
    const elapsedMs = Date.now() - command.lastTriggeredAt.getTime();
    if (elapsedMs < command.cooldownSeconds * 1000) return;
  }

  let responseText: string | null = null;

  if (command.standardKey) {
    const isModOrBroadcaster = hasPermission("moderator", msg, broadcasterTwitchId);
    responseText = await runStandardCommand(command.standardKey, {
      userId,
      broadcasterTwitchId,
      argsText,
      canManageChannel: isModOrBroadcaster,
      chatterName: msg.chatterName,
      chatterId: msg.chatterId,
      chatterLogin: msg.chatterLogin,
    });
  } else if (command.mode === "graph" && command.graph) {
    const result = await runBlueprint(
      command.graph as unknown as BpGraph,
      {
        vars: { user: msg.chatterName, message: msg.text, args: argsText, channel: msg.chatterLogin },
        viewer: { twitchId: msg.chatterId, login: msg.chatterLogin, name: msg.chatterName },
      },
      userId
    );
    if (result.error) {
      console.error(`[blueprint] ошибка в команде ${command.trigger}:`, result.error);
    }
    // У графа может быть несколько "Отправить в чат" - шлём все по порядку,
    // остальной пайплайн (cooldown, lastTriggeredAt) ниже общий с text-режимом.
    for (const text of result.sentMessages) {
      await sendChatMessage(botAccessToken, broadcasterTwitchId, botTwitchId, text, msg.messageId);
    }
    await prisma.botCommand.update({ where: { id: command.id }, data: { lastTriggeredAt: new Date() } });
    return;
  } else if (command.response) {
    responseText = await interpolateViewerVars(
      userId,
      msg.chatterId,
      command.response.replaceAll("{user}", msg.chatterName).replaceAll("{args}", argsText)
    );
  }

  if (!responseText) return;

  await sendChatMessage(botAccessToken, broadcasterTwitchId, botTwitchId, responseText, msg.messageId);
  await prisma.botCommand.update({
    where: { id: command.id },
    data: { lastTriggeredAt: new Date() },
  });
}
