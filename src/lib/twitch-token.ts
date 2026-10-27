import { prisma } from "@/lib/prisma";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const EXPIRY_BUFFER_MS = 60_000;
interface RefreshedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function refreshTwitchToken(refreshToken: string): Promise<RefreshedTokens> {
  const res = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Twitch token: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

/** Access token for the bot's own Twitch account (read/write chat). */
export async function getValidBotToken(userId: string): Promise<string | null> {
  const bot = await prisma.botAccount.findUnique({ where: { userId } });
  if (!bot) return null;

  if (bot.expiresAt.getTime() - Date.now() > EXPIRY_BUFFER_MS) {
    return bot.accessToken;
  }

  const refreshed = await refreshTwitchToken(bot.refreshToken);
  await prisma.botAccount.update({
    where: { userId },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });
  return refreshed.access_token;
}

/** Access token for the streamer's own Twitch account (channel management). */
export async function getValidBroadcasterToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({ where: { userId, provider: "twitch" } });
  if (!account?.access_token || !account.refresh_token) return null;

  const expiresAtMs = (account.expires_at ?? 0) * 1000;
  if (expiresAtMs - Date.now() > EXPIRY_BUFFER_MS) {
    return account.access_token;
  }

  const refreshed = await refreshTwitchToken(account.refresh_token);
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    },
  });
  return refreshed.access_token;
}

interface CachedAppToken {
  accessToken: string;
  expiresAt: number;
}

// Не привязан ни к какому пользователю (client_credentials grant), поэтому
// кэшируем на весь процесс. globalThis — та же причина, что и у activeBots
// в lib/bot/manager.ts: при hot reload в dev модуль может пересоздаться,
// и без анкоринга каждый релоад заново ходил бы за токеном в Twitch.
const globalForAppToken = globalThis as unknown as {
  __vtubeAppToken: CachedAppToken | undefined;
};

/**
 * App Access Token (client_credentials) — нужен, чтобы сообщения бота
 * получали "Chat Bot" бейдж (см. https://dev.twitch.tv/docs/chat/#chatbot-badge-and-chat).
 * Twitch выдаёт бейдж только сообщениям, отправленным через Send Chat
 * Message API именно с App Access Token'ом — токен самого бот-аккаунта
 * (User Access Token) на это не годится, даже если сообщение технически
 * то же самое.
 */
export async function getAppAccessToken(): Promise<string> {
  const cached = globalForAppToken.__vtubeAppToken;
  if (cached && cached.expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return cached.accessToken;
  }

  const res = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to get Twitch app access token: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const token: CachedAppToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  globalForAppToken.__vtubeAppToken = token;
  return token.accessToken;
}
