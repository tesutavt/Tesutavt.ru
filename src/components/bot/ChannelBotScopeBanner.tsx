import { signIn } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";

/**
 * channel:bot — scope, который стример выдаёт нашему приложению отдельно
 * (не путать с логином самого бот-аккаунта). Он нужен, чтобы сообщения
 * бота получали официальный "Chat Bot" бейдж Twitch, даже если бот не
 * модератор в канале. См. https://dev.twitch.tv/docs/chat/#chatbot-badge-and-chat
 *
 * Технически он уже добавлен в общий список scope в lib/auth.ts — Auth.js
 * (force_verify: true) покажет его на экране согласия при следующем входе
 * и синхронизирует в БД (см. events.signIn в lib/auth.ts). Отдельного
 * OAuth-флоу для этого не нужно: это не логин бота, а согласие самого
 * стримера на своём же аккаунте — работает и локально, без публичного
 * домена (в отличие от способа попасть в отдельный раздел "Боты" в списке
 * зрителей — тот требует Webhook-доставку EventSub с публичным HTTPS).
 */
export function ChannelBotScopeBanner() {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
      <ShieldCheck size={18} className="shrink-0 text-[var(--muted-foreground)]" />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--surface-foreground)]">
          Бейдж «Chat Bot» пока не выдан
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Сообщения бота получат официальный значок Twitch, если он модератор канала, либо если вы
          выдадите приложению доступ <span className="font-mono">channel:bot</span>. Перезайдите на
          своём аккаунте — на экране согласия Twitch появится новый пункт.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("twitch", { redirectTo: "/dashboard/bot" });
        }}
      >
        <button
          type="submit"
          className="shrink-0 rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-medium text-[var(--ink-foreground)] transition hover:opacity-90"
        >
          Перезайти
        </button>
      </form>
    </div>
  );
}
