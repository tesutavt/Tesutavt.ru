import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-[var(--background)] px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-[32px] bg-[var(--surface)] p-10 text-center shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ink)] text-lg font-bold text-[var(--ink-foreground)]">
          V
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--surface-foreground)]">
            VtubeOverlay
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Виджеты и оверлеи для стрима: готовые шаблоны или собственный
            HTML/CSS/JS с данными из Twitch.
          </p>
        </div>

        <form
          className="w-full"
          action={async () => {
            "use server";
            await signIn("twitch", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--ink-foreground)] transition hover:opacity-90"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M4.917 0 3.5 3.75V20h6.417V24l3.75-4h4.417L23.5 14.583V0H4.917Zm2.25 2.25h14.083v11.083l-3.083 3.084h-4.917L10 19.667v-3.25H7.167V2.25Zm4.75 3.583v6.417h2.25V5.833h-2.25Zm5.916 0v6.417h2.25V5.833h-2.25Z" />
            </svg>
            Войти через Twitch
          </button>
        </form>
      </div>
    </main>
  );
}
