import { Bot, Cable, Gift, Home, LayoutGrid, Music, UserCog, Users, type LucideIcon } from "lucide-react";

export interface NavPage {
  href: string;
  label: string;
  /** Подзаголовок страницы под её названием. */
  description: string;
  icon: LucideIcon;
}

/**
 * Разделы дашборда — единый источник для бокового меню и заголовков
 * страниц (<PageHeader page="bot" />). Новая страница = новая запись здесь.
 */
export const PAGES = {
  dashboard: {
    href: "/dashboard",
    label: "Дашборд",
    description: "Сводка по каналу, боту и быстрые настройки стрима.",
    icon: Home,
  },
  widgets: {
    href: "/dashboard/widgets",
    label: "Виджеты",
    description: "Оверлеи для OBS: готовые шаблоны или свой HTML/CSS/JS с данными Twitch.",
    icon: LayoutGrid,
  },
  music: {
    href: "/dashboard/music",
    label: "Музыка",
    description: "Очередь заказов !song, громкость и подключение Яндекс.Музыки. Ссылки YouTube работают без подключения.",
    icon: Music,
  },
  bot: {
    href: "/dashboard/bot",
    label: "Бот",
    description: "Бот в чате: команды, автосообщения по таймеру и секреты для Blueprint-графов.",
    icon: Bot,
  },
  rewards: {
    href: "/dashboard/rewards",
    label: "Награды за баллы",
    description: "Награды создаются здесь и сразу появляются на Twitch. Что происходит при получении — настраивается Blueprint-графом.",
    icon: Gift,
  },
  viewers: {
    href: "/dashboard/viewers",
    label: "Зрители",
    description: "Мини-база данных о зрителях, которую они заполняют сами из чата.",
    icon: Users,
  },
  vtubeStudio: {
    href: "/dashboard/vtube-studio",
    label: "VTube Studio",
    description: "Подключите VTube Studio — и зрители смогут запускать анимации модели командой !vts в чате.",
    icon: Cable,
  },
  access: {
    href: "/dashboard/access",
    label: "Редакторы",
    description: "Выдайте модераторам доступ к панели по нику Twitch — они смогут настраивать всё за вас.",
    icon: UserCog,
  },
} satisfies Record<string, NavPage>;

export type PageKey = keyof typeof PAGES;

export const NAV_ORDER: PageKey[] = [
  "dashboard",
  "widgets",
  "music",
  "bot",
  "rewards",
  "viewers",
  "vtubeStudio",
  "access",
];

/** Разделы только для владельца — в чужой панели не показываются. */
export const OWNER_ONLY_PAGES: PageKey[] = ["access"];
