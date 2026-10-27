import { getAppAccessToken } from "@/lib/twitch-token";
import { containsBannedWord } from "@/lib/moderation/banned-words";

export interface SendChatMessageResult {
  ok: boolean;
  isSent: boolean;
  dropReason?: string;
}

async function postChatMessage(
  token: string,
  broadcasterTwitchId: string,
  botTwitchId: string,
  message: string,
  replyParentMessageId?: string
): Promise<Response> {
  return fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: broadcasterTwitchId,
      sender_id: botTwitchId,
      message,
      ...(replyParentMessageId ? { reply_parent_message_id: replyParentMessageId } : {}),
    }),
  });
}

async function parseSendResult(res: Response): Promise<SendChatMessageResult> {
  if (!res.ok) return { ok: false, isSent: false };

  const { data } = (await res.json()) as {
    data: { is_sent: boolean; drop_reason?: { message: string } }[];
  };
  const result = data[0];
  return {
    ok: true,
    isSent: result?.is_sent ?? false,
    dropReason: result?.drop_reason?.message,
  };
}

/**
 * @param replyParentMessageId - id сообщения, на которое отвечаем (делает
 * ответ настоящим threaded reply в Twitch чате). Передаётся для команд —
 * они всегда реагируют на конкретное сообщение. НЕ передаётся для
 * таймеров (lib/bot/manager.ts) — у них нет "исходного" сообщения, на
 * которое стоило бы отвечать.
 */
export async function sendChatMessage(
  botAccessToken: string,
  broadcasterTwitchId: string,
  botTwitchId: string,
  message: string,
  replyParentMessageId?: string
): Promise<SendChatMessageResult> {
  // Все сообщения бота (команды, таймеры, блюпринты, награды) идут через
  // эту функцию — здесь последняя проверка на запрещённые слова: текст
  // может собраться из ответа внешнего API или данных зрителя.
  if (containsBannedWord(message)) {
    console.warn("[bot] сообщение не отправлено: запрещённое слово");
    return { ok: false, isSent: false, dropReason: "banned_word" };
  }

  // Твич показывает бейдж "Chat Bot" у сообщения, только если оно отправлено
  // через Send Chat Message API именно с App Access Token'ом (не токеном
  // самого бот-аккаунта) — и только когда бот либо модератор в канале, либо
  // получил от стримера scope channel:bot. См.
  // https://dev.twitch.tv/docs/chat/#chatbot-badge-and-chat
  //
  // Пробуем сначала App Access Token — если бот уже модератор (обычная
  // настройка), сообщение уйдёт с бейджем без каких-либо доп. действий.
  // Если приложение не авторизовано для этого канала (бот не модератор и
  // channel:bot не выдан), Twitch отклонит запрос — тогда просто
  // откатываемся на обычный токен бота, как и раньше, чтобы не сломать
  // отправку сообщений там, где бейдж пока недоступен.
  try {
    const appToken = await getAppAccessToken();
    const res = await postChatMessage(appToken, broadcasterTwitchId, botTwitchId, message, replyParentMessageId);
    if (res.ok) return parseSendResult(res);
  } catch (err) {
    console.error("[bot] не удалось отправить сообщение с App Access Token, откатываюсь на токен бота", err);
  }

  const res = await postChatMessage(botAccessToken, broadcasterTwitchId, botTwitchId, message, replyParentMessageId);
  return parseSendResult(res);
}
