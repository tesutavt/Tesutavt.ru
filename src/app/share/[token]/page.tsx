import { notFound } from "next/navigation";
import { signIn } from "@/lib/auth";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { getPresetById } from "@/lib/widget-presets";
import { AcceptShareButton } from "@/components/share/AcceptShareButton";
import { LayoutGrid, Sparkles } from "lucide-react";

interface SharedElement {
  name: string;
  kind: "preset" | "custom";
  presetId: string | null;
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await prisma.widgetShare.findUnique({ where: { token } });
  if (!share) notFound();

  const session = await panelSession();
  const elements = (share.elements as unknown as SharedElement[]) ?? [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-md rounded-3xl bg-[var(--surface)] p-6 shadow-lg shadow-black/10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--subtle)]">
            <LayoutGrid size={22} className="text-[var(--muted-foreground)]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              Вам поделились виджетом
            </p>
            <h1 className="text-lg font-semibold text-[var(--surface-foreground)]">{share.name}</h1>
          </div>
        </div>

        <div className="mb-5 rounded-2xl bg-[var(--subtle)] p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            <Sparkles size={13} /> Вы получите
          </p>
          <ul className="flex flex-col gap-1.5">
            <li className="text-sm text-[var(--surface-foreground)]">
              Холст {share.canvasWidth}×{share.canvasHeight}
            </li>
            {elements.length === 0 ? (
              <li className="text-sm text-[var(--muted-foreground)]">Пустой холст, без элементов</li>
            ) : (
              elements.map((el, i) => {
                const preset = el.kind === "preset" && el.presetId ? getPresetById(el.presetId) : undefined;
                return (
                  <li key={i} className="text-sm text-[var(--surface-foreground)]">
                    {preset ? preset.name : el.name || "Кастомный элемент"}
                    {preset && <span className="text-[var(--muted-foreground)]"> (готовый пресет)</span>}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <p className="mb-4 text-xs text-[var(--muted-foreground)]">
          Это создаст независимую копию в вашем аккаунте — свой холст, своя ссылка для OBS. Изменения в
          исходном виджете (у того, кто им поделился) на вашу копию не повлияют, и наоборот.
        </p>

        {session?.user ? (
          <AcceptShareButton token={token} />
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("twitch", { redirectTo: `/share/${token}` });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-medium text-[var(--ink-foreground)] transition hover:opacity-90"
            >
              Войти через Twitch, чтобы принять
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
