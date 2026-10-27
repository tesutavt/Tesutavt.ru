"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  MonitorSmartphone,
  MousePointerClick,
  Plug,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Card";
import { useVtsBridge, type VtsBridgeState } from "@/components/vts/useVtsBridge";

const AUTOSTART_KEY = "vts-bridge-autostart";

const noopSubscribe = () => () => {};

type Mode = "obs" | "browser" | null;

function detectMode(): Mode {
  const params = new URLSearchParams(window.location.search);
  // OBS Browser Source добавляет window.obsstudio; ?obs=1 — принудительно.
  if (params.has("obs") || "obsstudio" in window) return "obs";
  return "browser";
}

function readAutostart() {
  try {
    return localStorage.getItem(AUTOSTART_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Страница-мост VTube Studio (/vts/[token]).
 *
 * В OBS — прозрачная и невидимая, пока всё в порядке (?debug=1 показывает
 * статус всегда). В обычном браузере — понятный пошаговый экран: кнопка
 * «Подключить» → разрешение браузера на доступ к локальной сети →
 * «Allow» в VTube Studio → готово.
 */
export function VtsBridge({ token }: { token: string }) {
  const mode = useSyncExternalStore<Mode>(noopSubscribe, detectMode, () => null);
  if (mode === null) return null;
  return mode === "obs" ? <ObsBridge token={token} /> : <BrowserBridge token={token} />;
}

function ObsBridge({ token }: { token: string }) {
  const state = useVtsBridge(token, true);
  const debug = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false
  );

  if (state.code === "connected" && !debug) return null;

  return (
    <div
      style={{
        display: "inline-block",
        margin: 4,
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.65)",
        color: "#fff",
        font: "11px/1.4 system-ui, sans-serif",
      }}
    >
      VTube Studio: {state.detail}
    </div>
  );
}

function BrowserBridge({ token }: { token: string }) {
  const autostart = useSyncExternalStore(noopSubscribe, readAutostart, () => false);
  const [clicked, setClicked] = useState(false);
  const state = useVtsBridge(token, clicked || autostart);

  useEffect(() => {
    if (state.code !== "connected") return;
    // В следующий раз подключаемся сразу — разрешения уже выданы.
    try {
      localStorage.setItem(AUTOSTART_KEY, "1");
    } catch {
      // приватный режим — не страшно
    }
  }, [state.code]);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 px-4 py-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-base font-bold text-ink-foreground">
            V
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Подключение VTube Studio</h1>
            <p className="text-sm text-muted">VtubeOverlay · мост на этом компьютере</p>
          </div>
        </div>

        <Stepper code={state.code} />

        <div className="rounded-dialog bg-surface p-6 text-surface-foreground shadow-card">
          <StepBody state={state} onStart={() => setClicked(true)} />
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Доступ к компьютеру", "Разрешение в VTube Studio", "Готово"];

function stepIndex(code: VtsBridgeState["code"]) {
  if (code === "connected") return 2;
  if (code === "waiting-approval" || code === "authorizing" || code === "denied") return 1;
  return 0;
}

function Stepper({ code }: { code: VtsBridgeState["code"] }) {
  const current = stepIndex(code);
  const failed = code === "blocked" || code === "denied";
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < current || code === "connected";
        const active = i === current && !done;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300 ${
                done
                  ? "bg-success text-white"
                  : active
                    ? failed
                      ? "bg-danger text-white"
                      : "anim-pulse-ring bg-accent text-accent-foreground"
                    : "bg-subtle text-muted"
              }`}
            >
              {done ? <Check size={14} className="anim-pop-in" /> : i + 1}
            </span>
            <span className={`hidden text-xs sm:block ${active || done ? "text-foreground" : "text-muted"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="h-px flex-1 bg-border">
                <span
                  className="block h-px bg-success transition-all duration-500"
                  style={{ width: done ? "100%" : "0%" }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepBody({ state, onStart }: { state: VtsBridgeState; onStart: () => void }) {
  const reload = () => window.location.reload();

  switch (state.code) {
    case "waiting-click":
      return (
        <Body
          key="start"
          icon={<ShieldCheck size={26} />}
          tone="accent"
          title="Разрешите доступ к компьютеру"
          text={
            <>
              VTube Studio работает на вашем компьютере, а этот сайт — в интернете. Чтобы они связались, нажмите
              «Подключить». Если браузер спросит, <b>разрешить ли доступ к устройствам в локальной сети</b>, нажмите{" "}
              <b>«Разрешить»</b>.
            </>
          }
        >
          <Button size="lg" onClick={onStart} className="w-full">
            <Plug size={18} /> Подключить
          </Button>
        </Body>
      );

    case "connecting":
      return (
        <Body
          key="connecting"
          icon={<Loader2 size={26} className="animate-spin" />}
          tone="accent"
          title="Ищем VTube Studio…"
          text="Если браузер показал запрос доступа к локальной сети — нажмите «Разрешить»."
        />
      );

    case "no-vts":
      return (
        <Body
          key="no-vts"
          icon={<AlertTriangle size={26} />}
          tone="warning"
          title="VTube Studio не отвечает"
          text="Пробуем снова автоматически. Проверьте:"
        >
          <ul className="flex flex-col gap-2 text-sm">
            <Check1>VTube Studio запущен на этом компьютере</Check1>
            <Check1>
              В настройках VTube Studio включено <b>«Start API (allow plugins)»</b>
            </Check1>
            <Check1>
              Порт API в VTube Studio — <b>{state.port}</b> (его можно поменять в дашборде)
            </Check1>
          </ul>
        </Body>
      );

    case "blocked":
      return (
        <Body
          key="blocked"
          icon={<ShieldAlert size={26} />}
          tone="danger"
          title="Браузер запретил доступ"
          text="Без него страница не может достучаться до VTube Studio. Как разрешить:"
        >
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>Нажмите на значок слева от адреса сайта (замок или ползунки).</li>
            <li>
              Найдите <b>«Доступ к локальной сети»</b> (Local network access) и выберите <b>«Разрешить»</b>.
            </li>
            <li>Перезагрузите страницу.</li>
          </ol>
          <Button variant="secondary" onClick={reload} className="w-full">
            <RotateCcw size={16} /> Перезагрузить страницу
          </Button>
        </Body>
      );

    case "waiting-approval":
    case "authorizing":
      return (
        <Body
          key="approval"
          icon={<MousePointerClick size={26} />}
          tone="accent"
          pulse
          title="Подтвердите в VTube Studio"
          text={
            <>
              Переключитесь в окно VTube Studio — там появился запрос от плагина <b>VtubeOverlay</b>. Нажмите{" "}
              <b>«Allow»</b>. Это нужно сделать только один раз.
            </>
          }
        >
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Ждём подтверждения…
          </p>
        </Body>
      );

    case "denied":
      return (
        <Body
          key="denied"
          icon={<XCircle size={26} />}
          tone="danger"
          title="Доступ отклонён"
          text="В VTube Studio нажали «Deny». Попробуйте ещё раз и нажмите «Allow»."
        >
          <Button onClick={reload} className="w-full">
            <RotateCcw size={16} /> Попробовать снова
          </Button>
        </Body>
      );

    case "connected":
      return (
        <Body
          key="connected"
          icon={<CheckCircle2 size={28} />}
          tone="success"
          title="Всё подключено!"
          text={
            state.model
              ? `Модель «${state.model}», хоткеев: ${state.hotkeyCount ?? 0}. Команда !vts в чате уже работает.`
              : "VTube Studio подключён. Загрузите модель — её хоткеи появятся в дашборде."
          }
        >
          <Notice tone="neutral" icon={MonitorSmartphone}>
            <b>Не закрывайте эту вкладку</b>, пока идёт стрим — через неё команды попадают в VTube Studio. Или
            добавьте ссылку из дашборда в OBS как источник «Браузер» — тогда вкладку можно закрыть.
          </Notice>
          <a href="/dashboard/vtube-studio" className={buttonClass("primary", "md", "w-full")}>
            Вернуться в дашборд
          </a>
        </Body>
      );
  }
}

const TONES = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

function Body({
  icon,
  tone,
  title,
  text,
  pulse,
  children,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  title: string;
  text: React.ReactNode;
  pulse?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="anim-dialog-in flex flex-col items-center gap-5 text-center">
      <div
        className={`anim-pop-in flex h-16 w-16 items-center justify-center rounded-3xl ${TONES[tone]} ${pulse ? "anim-pulse-ring" : ""}`}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{text}</p>
      </div>
      {children && <div className="flex w-full flex-col gap-4 text-left">{children}</div>}
    </div>
  );
}

function Check1({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={16} className="mt-0.5 shrink-0 text-muted" />
      <span>{children}</span>
    </li>
  );
}
