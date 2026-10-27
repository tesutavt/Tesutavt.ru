import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VtubeOverlay",
  description: "Виджеты и оверлеи для стримеров, кастомизируемые под Twitch",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // THEME_INIT_SCRIPT ниже добавляет класс 'dark' на <html> ДО того как
      // React гидратируется (обычный приём против "мигания" темы) — сервер
      // не может знать тему из localStorage/prefers-color-scheme заранее,
      // так что className на этом узле всегда будет расходиться при
      // гидратации. Это ожидаемо и безопасно — suppressHydrationWarning
      // ограничен ровно этим узлом, вложенные несовпадения он не скроет.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
