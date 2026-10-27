"use client";

import { useState } from "react";
import { Music2, ExternalLink } from "lucide-react";

// Публичный client_id официального приложения "Яндекс Музыка" — единственный
// вариант получить токен для неофициального API (свои OAuth-приложения для
// Музыки Яндекс не даёт создавать). Тот же client_id используют другие
// open-source проекты (yandex-music-api и т.д.).
const YANDEX_AUTHORIZE_URL =
  "https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d";

export function YandexConnectSection({ connected, uid }: { connected: boolean; uid: number | null }) {
  const [isConnected, setIsConnected] = useState(connected);
  const [currentUid, setCurrentUid] = useState(uid);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (!token.trim()) return;
    setStatus("saving");
    setError(null);
    const res = await fetch("/api/music/yandex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setIsConnected(true);
      setCurrentUid(data.uid);
      setToken("");
      setStatus("idle");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не получилось подключить аккаунт");
      setStatus("error");
    }
  }

  async function disconnect() {
    await fetch("/api/music/yandex", { method: "DELETE" });
    setIsConnected(false);
    setCurrentUid(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[var(--surface)] p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--subtle)]">
          <Music2 size={18} className="text-[var(--muted-foreground)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Яндекс.Музыка</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {isConnected ? `Подключено (uid ${currentUid ?? "?"})` : "Не подключено — доступны только ссылки YouTube"}
          </p>
        </div>
      </div>

      {isConnected ? (
        <button
          onClick={disconnect}
          className="w-fit rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--surface-foreground)] transition hover:bg-[var(--subtle)]"
        >
          Отключить
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--border)] p-3">
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            У Яндекса нет собственных OAuth-приложений для Музыки, поэтому токен получают вручную:
            откройте ссылку, войдите под аккаунтом, с которого хотите проигрывать музыку, и скопируйте
            значение <span className="font-mono">access_token</span> из адресной строки открывшейся страницы
            (после <span className="font-mono">#access_token=</span> и до <span className="font-mono">&amp;</span>).
          </p>
          <a
            href={YANDEX_AUTHORIZE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--foreground)] underline underline-offset-2"
          >
            Открыть страницу входа <ExternalLink size={14} />
          </a>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Вставьте access_token сюда"
              className="min-w-[260px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--surface-foreground)] outline-none focus:border-accent"
            />
            <button
              onClick={connect}
              disabled={status === "saving" || !token.trim()}
              className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--ink-foreground)] transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "saving" ? "Проверяем…" : "Подключить"}
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
