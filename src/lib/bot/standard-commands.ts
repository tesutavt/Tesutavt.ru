import type { CommandUserLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppAccessToken, getValidBroadcasterToken } from "@/lib/twitch-token";
import { getChannelInfo, setChannelTitle, findGameByName, setChannelGame } from "@/lib/twitch-channel";
import { requestSong } from "@/lib/music/request-handler";
import { getState, getSettings, setVolume, skip, formatCurrentTrackText } from "@/lib/music/queue";
import { fireVtsTrigger } from "@/lib/bot/vts-fire";
import { runSetCommand, runGetCommand, runUnsetCommand, seedViewerFields } from "@/lib/viewer-data";

export const STANDARD_COMMAND_DEFAULTS: {
  trigger: string;
  standardKey: string;
  userLevel: CommandUserLevel;
}[] = [
  { trigger: "!ping", standardKey: "ping", userLevel: "everyone" },
  { trigger: "!title", standardKey: "title", userLevel: "everyone" },
  { trigger: "!game", standardKey: "game", userLevel: "everyone" },
  { trigger: "!song", standardKey: "song", userLevel: "everyone" },
  { trigger: "!skip", standardKey: "skip", userLevel: "moderator" },
  { trigger: "!volume", standardKey: "volume", userLevel: "moderator" },
  { trigger: "!vts", standardKey: "vts", userLevel: "everyone" },
  { trigger: "!set", standardKey: "viewerSet", userLevel: "everyone" },
  { trigger: "!get", standardKey: "viewerGet", userLevel: "everyone" },
  { trigger: "!unset", standardKey: "viewerUnset", userLevel: "everyone" },
];

/**
 * Идемпотентно доводит набор команд пользователя до STANDARD_COMMAND_DEFAULTS —
 * вызывается и при первом подключении бота (bot/callback), и при каждом
 * заходе на вкладку бота, чтобы новые встроенные команды (например !song)
 * появлялись у уже подключённых стримеров без переподключения.
 */
export async function seedStandardCommands(userId: string) {
  for (const cmd of STANDARD_COMMAND_DEFAULTS) {
    await prisma.botCommand.upsert({
      where: { userId_trigger: { userId, trigger: cmd.trigger } },
      create: { userId, ...cmd },
      update: {},
    });
  }
  await seedViewerFields(userId);
}

export interface StandardCommandContext {
  userId: string;
  broadcasterTwitchId: string;
  argsText: string;
  canManageChannel: boolean;
  chatterName: string;
  chatterId: string;
  chatterLogin: string;
}

function formatDuration(ms: number) {
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d) return `${d} д ${h} ч`;
  if (h) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T | null }> {
  const start = performance.now();
  try {
    const value = await fn();
    return { ms: Math.round(performance.now() - start), value };
  } catch {
    return { ms: -1, value: null };
  }
}

/**
 * !ping — реальное состояние: задержка базы и Twitch API, сколько работает
 * сервер бота и сколько идёт стрим. (Redis в проекте нет — всё в PostgreSQL.)
 */
async function runPingCommand(ctx: StandardCommandContext): Promise<string> {
  const [db, twitch] = await Promise.all([
    timed(() => prisma.$queryRaw`SELECT 1`),
    timed(async () => {
      const token = await getAppAccessToken();
      const res = await fetch(`https://api.twitch.tv/helix/streams?user_id=${ctx.broadcasterTwitchId}`, {
        headers: { Authorization: `Bearer ${token}`, "Client-Id": process.env.TWITCH_CLIENT_ID! },
      });
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { data: { started_at: string }[] }).data[0] ?? null;
    }),
  ]);

  const ms = (v: number) => (v < 0 ? "ошибка" : `${v} мс`);
  const parts = [
    `БД ${ms(db.ms)}`,
    `Twitch API ${ms(twitch.ms)}`,
    `сервер работает ${formatDuration(process.uptime() * 1000)}`,
  ];
  const stream = twitch.value;
  parts.push(stream ? `стрим идёт ${formatDuration(Date.now() - Date.parse(stream.started_at))}` : "стрим офлайн");
  return `Pong! 🏓 ${parts.join(" · ")}`;
}

async function runTitleCommand(ctx: StandardCommandContext, token: string): Promise<string> {
  const newTitle = ctx.argsText.trim();
  if (newTitle && ctx.canManageChannel) {
    const ok = await setChannelTitle(token, ctx.broadcasterTwitchId, newTitle);
    return ok ? `Название стрима изменено: ${newTitle}` : "Не получилось сменить название стрима.";
  }

  const channel = await getChannelInfo(token, ctx.broadcasterTwitchId);
  return channel ? `Название стрима: ${channel.title}` : "Не удалось получить название стрима.";
}

async function runGameCommand(ctx: StandardCommandContext, token: string): Promise<string> {
  const newGame = ctx.argsText.trim();
  if (newGame && ctx.canManageChannel) {
    const game = await findGameByName(token, newGame);
    if (!game) return `Категория "${newGame}" не найдена.`;
    const ok = await setChannelGame(token, ctx.broadcasterTwitchId, game.id);
    return ok ? `Категория изменена: ${game.name}` : "Не получилось сменить категорию.";
  }

  const channel = await getChannelInfo(token, ctx.broadcasterTwitchId);
  return channel ? `Текущая категория: ${channel.gameName}` : "Не удалось получить категорию.";
}

async function runSongCommand(ctx: StandardCommandContext): Promise<string> {
  const query = ctx.argsText.trim();
  if (!query) {
    const state = await getState(ctx.userId);
    return formatCurrentTrackText(state.current);
  }

  const result = await requestSong(ctx.userId, query, {
    requestedBy: ctx.chatterName,
    requestSource: "chat",
  });

  if (!result.ok) {
    if (result.reason === "not_found") return `Ничего не найдено по запросу «${query}».`;
    if (result.reason === "yandex_not_connected") {
      return "Яндекс.Музыка не подключена в настройках — по текстовому запросу искать негде, но ссылки YouTube работают.";
    }
    return `Не получилось добавить трек: ${result.error ?? "неизвестная ошибка"}`;
  }

  const tracks = result.tracks ?? [];
  if (tracks.length > 1) return `Добавлено ${tracks.length} треков в очередь.`;
  const track = result.track!;
  return `Добавлено: ${track.artist} — ${track.title}`;
}

async function runSkipCommand(ctx: StandardCommandContext): Promise<string> {
  if (!ctx.canManageChannel) return "Пропускать треки может только модератор.";
  const next = await skip(ctx.userId);
  return next ? `Трек пропущен. Сейчас играет: ${next.artist} — ${next.title}` : "Трек пропущен. Очередь пуста.";
}

async function runVolumeCommand(ctx: StandardCommandContext): Promise<string> {
  const arg = ctx.argsText.trim();
  if (!arg) {
    const settings = await getSettings(ctx.userId);
    return `Текущая громкость: ${Math.round(settings.volume * 100)}%`;
  }

  if (!ctx.canManageChannel) return "Менять громкость может только модератор.";

  const value = Number(arg.replace("%", "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return "Укажите громкость от 0 до 100, например: !volume 50";
  }

  await setVolume(ctx.userId, value / 100);
  return `Громкость установлена: ${Math.round(value)}%`;
}

async function runVtsCommand(ctx: StandardCommandContext): Promise<string> {
  const name = ctx.argsText.trim().toLowerCase();
  if (!name) {
    const triggers = await prisma.vtsTrigger.findMany({ where: { userId: ctx.userId }, select: { name: true } });
    if (!triggers.length) return "Триггеры VTube Studio ещё не настроены (вкладка VTube Studio в дашборде).";
    return `Доступные триггеры: ${triggers.map((t) => t.name).join(", ")}`;
  }

  const result = await fireVtsTrigger(ctx.userId, { name });
  if (!result.ok) return result.error ?? "Не получилось запустить триггер.";
  return `Триггер «${name}» отправлен в VTube Studio.`;
}

export async function runStandardCommand(
  standardKey: string,
  ctx: StandardCommandContext
): Promise<string | null> {
  if (standardKey === "ping") return runPingCommand(ctx);
  if (standardKey === "song") return runSongCommand(ctx);
  if (standardKey === "skip") return runSkipCommand(ctx);
  if (standardKey === "volume") return runVolumeCommand(ctx);
  if (standardKey === "vts") return runVtsCommand(ctx);
  if (standardKey === "viewerSet" || standardKey === "viewerGet" || standardKey === "viewerUnset") {
    const viewer = { twitchId: ctx.chatterId, login: ctx.chatterLogin, name: ctx.chatterName };
    if (standardKey === "viewerSet") return runSetCommand(ctx.userId, viewer, ctx.argsText);
    if (standardKey === "viewerGet") return runGetCommand(ctx.userId, viewer, ctx.argsText);
    return runUnsetCommand(ctx.userId, viewer, ctx.argsText);
  }

  const token = await getValidBroadcasterToken(ctx.userId);
  if (!token) return null;

  if (standardKey === "title") return runTitleCommand(ctx, token);
  if (standardKey === "game") return runGameCommand(ctx, token);
  return null;
}
