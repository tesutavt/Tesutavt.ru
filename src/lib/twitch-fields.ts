/**
 * Статический каталог данных Twitch, доступных виджету.
 *
 * Используется в редакторе (панель "Twitch Data" для вставки сниппетов) и для
 * генерации фейковых sample-payload'ов в live-preview. В Phase 2 те же ключи
 * будут заполняться реальными данными из EventSub/Helix и приходить в виджет
 * через тот же `window.widget.channel` / `window.onWidgetEvent(type, data)`.
 */

export interface TwitchFieldDef {
  /** Путь до значения в объекте, который получает виджет, например "user.badges.isMod" */
  path: string;
  label: string;
  sample: unknown;
}

export interface TwitchEventDef {
  /** Идентификатор события, передаётся первым аргументом в window.onWidgetEvent */
  id: string;
  label: string;
  description: string;
  fields: TwitchFieldDef[];
  sample: Record<string, unknown>;
}

export const CHANNEL_FIELDS: TwitchFieldDef[] = [
  { path: "channel.displayName", label: "Имя канала", sample: "CoolStreamer" },
  { path: "channel.login", label: "Логин канала (ник для URL/API)", sample: "coolstreamer" },
  { path: "channel.id", label: "Numeric ID канала (Twitch user id)", sample: "123456789" },
  {
    path: "channel.avatarUrl",
    label: "Аватар канала",
    sample: "https://static-cdn.jtvnw.net/jtv_user_pictures/sample-avatar.png",
  },
  { path: "channel.followerCount", label: "Кол-во фолловеров", sample: 12345 },
  { path: "channel.title", label: "Название стрима", sample: "Играем в StreamElements-клон" },
  { path: "channel.game", label: "Категория/игра", sample: "Software and Game Development" },
  { path: "channel.isLive", label: "В эфире", sample: true },
];

const chatUserFields: TwitchFieldDef[] = [
  { path: "user.name", label: "Ник зрителя", sample: "viewer_123" },
  {
    path: "user.avatar",
    label: "Аватар зрителя",
    sample: "https://static-cdn.jtvnw.net/jtv_user_pictures/sample-viewer.png",
  },
  { path: "user.color", label: "Цвет ника в чате", sample: "#FF69B4" },
  { path: "user.badges.isMod", label: "Модератор", sample: false },
  { path: "user.badges.isVip", label: "VIP", sample: true },
  { path: "user.badges.isSub", label: "Подписчик", sample: true },
  { path: "user.badges.isBroadcaster", label: "Стример (владелец канала)", sample: false },
];

export const TWITCH_EVENTS: TwitchEventDef[] = [
  {
    id: "follow",
    label: "Новый фолловер",
    description: "Срабатывает, когда зритель подписывается (follow) на канал",
    fields: [
      { path: "user.name", label: "Ник фолловера", sample: "new_follower" },
      {
        path: "user.avatar",
        label: "Аватар фолловера",
        sample: "https://static-cdn.jtvnw.net/jtv_user_pictures/sample-follower.png",
      },
    ],
    sample: {
      user: {
        name: "new_follower",
        avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/sample-follower.png",
      },
    },
  },
  {
    id: "subscribe",
    label: "Новая подписка",
    description: "Срабатывает при новой платной подписке на канал",
    fields: [
      { path: "user.name", label: "Ник подписчика", sample: "new_subscriber" },
      { path: "tier", label: "Уровень подписки (1000/2000/3000)", sample: "1000" },
      { path: "months", label: "Кол-во месяцев подряд", sample: 1 },
      { path: "message", label: "Сообщение от подписчика", sample: "Люблю стрим!" },
    ],
    sample: {
      user: { name: "new_subscriber" },
      tier: "1000",
      months: 1,
      message: "Люблю стрим!",
    },
  },
  {
    id: "giftSub",
    label: "Подарочная подписка",
    description: "Срабатывает, когда зритель дарит подписки другим",
    fields: [
      { path: "gifter.name", label: "Ник дарителя", sample: "generous_viewer" },
      { path: "count", label: "Кол-во подарочных подписок", sample: 5 },
      { path: "tier", label: "Уровень подписки", sample: "1000" },
    ],
    sample: {
      gifter: { name: "generous_viewer" },
      count: 5,
      tier: "1000",
    },
  },
  {
    id: "cheer",
    label: "Донат битами (Cheer)",
    description: "Срабатывает при получении Bits",
    fields: [
      { path: "user.name", label: "Ник отправителя", sample: "bits_fan" },
      { path: "bits", label: "Кол-во бит", sample: 500 },
      { path: "message", label: "Сообщение", sample: "Держи биты!" },
    ],
    sample: {
      user: { name: "bits_fan" },
      bits: 500,
      message: "Держи биты!",
    },
  },
  {
    id: "raid",
    label: "Рейд",
    description: "Срабатывает при рейде от другого канала",
    fields: [
      { path: "from.name", label: "Канал, откуда рейд", sample: "friendly_streamer" },
      { path: "viewers", label: "Кол-во зрителей в рейде", sample: 42 },
    ],
    sample: {
      from: { name: "friendly_streamer" },
      viewers: 42,
    },
  },
  {
    id: "chatMessage",
    label: "Сообщение в чате",
    description: "Срабатывает на каждое новое сообщение в чате канала",
    fields: [
      ...chatUserFields,
      { path: "message.text", label: "Текст сообщения", sample: "Привет из чата!" },
      {
        path: "message.emotes",
        label: "Список эмоутов в сообщении",
        sample: ["Kappa"],
      },
    ],
    sample: {
      user: {
        name: "viewer_123",
        avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/sample-viewer.png",
        color: "#FF69B4",
        badges: { isMod: false, isVip: true, isSub: true, isBroadcaster: false },
      },
      message: { text: "Привет из чата! Kappa", emotes: ["Kappa"] },
    },
  },
];

export function buildSampleChannel() {
  return CHANNEL_FIELDS.reduce<Record<string, unknown>>((acc, field) => {
    const key = field.path.split(".").pop()!;
    acc[key] = field.sample;
    return acc;
  }, {});
}

export function getEventById(id: string): TwitchEventDef | undefined {
  return TWITCH_EVENTS.find((event) => event.id === id);
}
