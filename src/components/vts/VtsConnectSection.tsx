"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  Cable,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MousePointerClick,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, IconTile, Notice, Section } from "@/components/ui/Card";
import { CodeBlock, Field, Input, Select } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { BRIDGE_ONLINE_MS, VTS_STATUS_TEXT, wizardStepFor, type VtsBridgeCode } from "@/components/vts/vts-status";

interface VtsTriggerView {
  id: string;
  name: string;
  hotkeyId: string;
  hotkeyLabel: string;
}

interface VtsHotkey {
  hotkeyID: string;
  name: string;
  type: string;
  file?: string;
}

interface VtsConnectionView {
  port: number;
  hotkeys: VtsHotkey[];
  bridgeToken: string;
  bridgeStatus: string | null;
  lastSeenAt: string | null;
  authorized: boolean;
}

const STATUS_POLL_MS = 2000;

const noopSubscribe = () => () => {};

function hotkeyLabel(h: VtsHotkey) {
  return h.name || h.file || h.type;
}

async function errorText(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? fallback;
}

export function VtsConnectSection({
  initialConnection,
  initialTriggers,
  legacyBridgeCount,
  appPort,
}: {
  initialConnection: VtsConnectionView;
  initialTriggers: VtsTriggerView[];
  legacyBridgeCount: number;
  appPort: string;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [connection, setConnection] = useState(initialConnection);
  const [triggers, setTriggers] = useState(initialTriggers);
  const [now, setNow] = useState(() => Date.now());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "https://your-site.com"
  );

  const { hotkeys, bridgeToken } = connection;
  const bridgeUrl = `${origin}/vts/${bridgeToken}`;
  const online = connection.lastSeenAt !== null && now - new Date(connection.lastSeenAt).getTime() < BRIDGE_ONLINE_MS;
  const code = (online ? connection.bridgeStatus : null) as VtsBridgeCode | null;
  const connected = code === "connected";

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch("/api/vts/connection", { cache: "no-store" });
        if (res.ok && !cancelled) setConnection(await res.json());
      } catch {
        // попробуем на следующем тике
      }
      if (!cancelled) {
        setNow(Date.now());
        timer = setTimeout(poll, STATUS_POLL_MS);
      }
    }

    timer = setTimeout(poll, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  async function patchConnection(body: Record<string, unknown>, success: string) {
    const res = await fetch("/api/vts/connection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setConnection(await res.json());
      if (online) toast.success(success);
      else toast.info(success, "Мост сейчас не запущен — изменения применятся, когда он откроется.");
      return true;
    }
    toast.error("Не получилось сохранить");
    return false;
  }

  async function testTrigger(name: string) {
    const res = await fetch(`/api/public/overlay/${bridgeToken}/vts/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) toast.error(await errorText(res, "Не получилось запустить триггер"));
    else if (online) toast.success(`Отправлено: !vts ${name}`);
    else toast.warning("Отправлено, но мост сейчас не запущен", "Откройте страницу подключения или источник в OBS.");
  }

  async function deleteTrigger(t: VtsTriggerView) {
    const ok = await confirm({
      title: `Удалить триггер «${t.name}»?`,
      description: `Команда !vts ${t.name} перестанет работать.`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/vts/triggers/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      setTriggers((prev) => prev.filter((x) => x.id !== t.id));
      toast.success("Триггер удалён");
    } else {
      toast.error("Не получилось удалить триггер");
    }
  }

  const status = statusView(code, online, hotkeys.length);

  return (
    <div className="flex flex-col gap-8">
      {legacyBridgeCount > 0 && (
        <Notice tone="warning" icon={AlertTriangle} title="Остался старый виджет-мост">
          На ваших холстах есть виджет «VTube Studio (мост)» ({legacyBridgeCount} шт.). Он больше не нужен — удалите
          его в редакторе, иначе хоткеи будут срабатывать дважды.
        </Notice>
      )}

      <Card className="flex flex-wrap items-center gap-5 p-6">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors duration-300 ${status.tile}`}
        >
          <status.icon size={26} className={status.spin ? "animate-spin" : ""} />
        </div>
        <div className="min-w-[200px] flex-1">
          <p className="text-lg font-semibold">{status.title}</p>
          <p className="text-sm text-muted">{status.text}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button
                variant="secondary"
                onClick={() => patchConnection({ refreshHotkeys: true }, "Запросили хоткеи у VTube Studio")}
              >
                <RefreshCw size={16} /> Обновить хоткеи
              </Button>
              <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
                <Settings2 size={16} /> Настройки
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
                <Settings2 size={16} /> Настройки
              </Button>
              <Button variant="accent" size="lg" onClick={() => setWizardOpen(true)}>
                <Cable size={18} /> {online ? "Продолжить подключение" : "Начать подключение"}
              </Button>
            </>
          )}
        </div>
      </Card>

      <Section
        title="Триггеры"
        icon={Zap}
        description={
          <>
            Зрители запускают хоткей модели командой <span className="font-mono">!vts имя</span> в чате.
          </>
        }
        actions={
          <Button onClick={() => setTriggerOpen(true)} disabled={hotkeys.length === 0}>
            <Plus size={16} /> Новый триггер
          </Button>
        }
      >
        {triggers.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Триггеров пока нет"
            description={
              hotkeys.length > 0
                ? "Выберите хоткей модели и дайте ему короткое имя — например, wave."
                : connected
                  ? "У текущей модели нет хоткеев. Создайте их в VTube Studio и нажмите «Обновить хоткеи»."
                  : "Хоткеи модели появятся, когда VTube Studio будет подключён."
            }
            action={
              hotkeys.length > 0 ? (
                <Button variant="secondary" onClick={() => setTriggerOpen(true)}>
                  <Plus size={16} /> Добавить триггер
                </Button>
              ) : !connected ? (
                <Button variant="secondary" onClick={() => setWizardOpen(true)}>
                  <Cable size={16} /> Подключить VTube Studio
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {triggers.map((t) => (
              <Card key={t.id} className="flex items-center gap-3 p-3">
                <IconTile icon={Zap} tone="accent" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium">!vts {t.name}</p>
                  <p className="truncate text-xs text-muted">{t.hotkeyLabel || t.hotkeyId}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => testTrigger(t.name)} title="Проверить">
                  <Play size={16} />
                </Button>
                <Button variant="danger" size="icon" onClick={() => deleteTrigger(t)} title="Удалить">
                  <Trash2 size={16} />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <ConnectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        code={code}
        online={online}
        port={connection.port}
        bridgeUrl={bridgeUrl}
        hotkeyCount={hotkeys.length}
        onSavePort={(port) => patchConnection({ port }, "Порт сохранён")}
        onRetry={() => patchConnection({ resetAuth: true }, "Переподключаемся — подтвердите доступ в VTube Studio")}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        port={connection.port}
        bridgeUrl={bridgeUrl}
        httpBridgeUrl={`http://${origin.replace(/^https?:\/\//, "").replace(/:\d+$/, "")}:${appPort}/vts/${bridgeToken}`}
        relayCommand={`node tools/vts-relay.js --url ${origin} --token ${bridgeToken}`}
        appPort={appPort}
        onSavePort={(port) => patchConnection({ port }, "Порт сохранён, мост переподключается")}
        onReconnect={() =>
          patchConnection({ resetAuth: true }, "Переподключаемся — подтвердите доступ в VTube Studio")
        }
      />

      <TriggerModal
        open={triggerOpen}
        onClose={() => setTriggerOpen(false)}
        hotkeys={hotkeys}
        onCreated={(trigger) => {
          setTriggers((prev) => [...prev, trigger]);
          toast.success(`Триггер «${trigger.name}» добавлен`, `Команда в чате: !vts ${trigger.name}`);
        }}
      />
    </div>
  );
}

function statusView(code: VtsBridgeCode | null, online: boolean, hotkeyCount: number) {
  if (!online) {
    return {
      icon: Cable,
      tile: "bg-subtle text-muted",
      title: "VTube Studio не подключён",
      text: "Нажмите «Начать подключение» — мы проведём по шагам.",
      spin: false,
    };
  }
  if (code === "connected") {
    return {
      icon: CheckCircle2,
      tile: "bg-success-soft text-success",
      title: "VTube Studio подключён",
      text: hotkeyCount ? `Хоткеев у модели: ${hotkeyCount}. Команда !vts работает.` : "Модель не загружена или у неё нет хоткеев.",
      spin: false,
    };
  }
  if (code === "no-vts" || code === "blocked" || code === "denied") {
    return {
      icon: code === "blocked" ? ShieldAlert : code === "denied" ? XCircle : AlertTriangle,
      tile: code === "no-vts" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger",
      title: "Есть проблема с подключением",
      text: VTS_STATUS_TEXT[code],
      spin: false,
    };
  }
  return {
    icon: code === "waiting-approval" ? MousePointerClick : Loader2,
    tile: "bg-accent-soft text-accent",
    title: "Подключаемся…",
    text: VTS_STATUS_TEXT[code ?? "connecting"] ?? "Мост запущен",
    spin: code !== "waiting-approval",
  };
}

/* ---------------- Мастер подключения ---------------- */

const WIZARD_STEPS = ["Подготовка", "Доступ", "VTube Studio", "Готово"];

function ConnectWizard({
  open,
  onClose,
  code,
  online,
  port,
  bridgeUrl,
  hotkeyCount,
  onSavePort,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  code: VtsBridgeCode | null;
  online: boolean;
  port: number;
  bridgeUrl: string;
  hotkeyCount: number;
  onSavePort: (port: number) => Promise<boolean>;
  onRetry: () => void;
}) {
  // Шаг 1 пользователь проходит сам; дальше шаг определяется состоянием моста.
  const [prepared, setPrepared] = useState(false);
  const [portDraft, setPortDraft] = useState(String(port));
  const [opened, setOpened] = useState(false);
  const step = prepared || online ? wizardStepFor(code, online) : 1;

  function openBridge() {
    window.open(bridgeUrl, "_blank", "noopener");
    setOpened(true);
  }

  async function next() {
    const value = Number(portDraft);
    if (value !== port && Number.isFinite(value) && value > 0) await onSavePort(value);
    setPrepared(true);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Cable}
      iconTone="accent"
      title="Подключение VTube Studio"
      description="Займёт минуту. Всё делается на компьютере, где запущен VTube Studio."
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={next}>Дальше</Button>
          </>
        ) : step === 4 ? (
          <Button onClick={onClose}>Готово</Button>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        )
      }
    >
      <WizardStepper step={step} failed={code === "blocked" || code === "denied"} />

      <div key={step} className="anim-dialog-in mt-5">
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">Подготовьте VTube Studio:</p>
            <ol className="flex flex-col gap-3 text-sm">
              <WizardItem n={1}>Запустите VTube Studio на этом компьютере.</WizardItem>
              <WizardItem n={2}>
                Откройте настройки (шестерёнка) и включите <b>«Start API (allow plugins)»</b>.
              </WizardItem>
              <WizardItem n={3}>
                Проверьте, что порт API совпадает с указанным ниже (обычно <b>8001</b>).
              </WizardItem>
            </ol>
            <Field label="Порт API VTube Studio" className="max-w-[180px]">
              <Input type="number" value={portDraft} onChange={(e) => setPortDraft(e.target.value)} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Откройте страницу подключения и нажмите на ней <b>«Подключить»</b>. Браузер спросит, разрешить ли
              сайту <b>доступ к устройствам в локальной сети</b> — нажмите <b>«Разрешить»</b>. Это нужно, чтобы
              сайт мог связаться с VTube Studio на вашем компьютере.
            </p>
            <Button variant="accent" size="lg" onClick={openBridge} className="w-full">
              <ExternalLink size={18} /> {opened ? "Открыть страницу ещё раз" : "Открыть страницу подключения"}
            </Button>
            <LiveStatus code={code} online={online} opened={opened} port={port} />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center gap-4 text-center">
            {code === "denied" ? (
              <>
                <div className="anim-pop-in flex h-16 w-16 items-center justify-center rounded-3xl bg-danger-soft text-danger">
                  <XCircle size={28} />
                </div>
                <div>
                  <p className="text-lg font-semibold">Доступ отклонён</p>
                  <p className="mt-1 text-sm text-muted">В VTube Studio нажали «Deny». Попробуем ещё раз?</p>
                </div>
                <Button onClick={onRetry}>
                  <RotateCcw size={16} /> Попробовать снова
                </Button>
              </>
            ) : (
              <>
                <div className="anim-pulse-ring flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-accent">
                  <MousePointerClick size={28} />
                </div>
                <div>
                  <p className="text-lg font-semibold">Подтвердите в VTube Studio</p>
                  <p className="mt-1 text-sm text-muted">
                    Переключитесь в окно VTube Studio — там появился запрос от плагина <b>VtubeOverlay</b>. Нажмите{" "}
                    <b>«Allow»</b>.
                  </p>
                </div>
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" /> Ждём подтверждения…
                </p>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="anim-pop-in flex h-16 w-16 items-center justify-center rounded-3xl bg-success-soft text-success">
              <CheckCircle2 size={30} />
            </div>
            <div>
              <p className="text-lg font-semibold">Всё готово!</p>
              <p className="mt-1 text-sm text-muted">
                {hotkeyCount
                  ? `VTube Studio подключён, хоткеев у модели: ${hotkeyCount}. Теперь создайте триггеры.`
                  : "VTube Studio подключён. Загрузите модель с хоткеями — они появятся здесь."}
              </p>
            </div>
            <Notice tone="neutral">
              <span className="text-left">
                Страница подключения должна оставаться открытой во время стрима. Чтобы не держать вкладку — добавьте
                ссылку в OBS как источник «Браузер» (кнопка «Настройки»).
              </span>
            </Notice>
          </div>
        )}
      </div>
    </Modal>
  );
}

function WizardStepper({ step, failed }: { step: number; failed: boolean }) {
  return (
    <ol className="flex items-center gap-1.5">
      {WIZARD_STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step || step === 4;
        const active = n === step && !done;
        return (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-300 ${
                done
                  ? "bg-success text-white"
                  : active
                    ? failed
                      ? "bg-danger text-white"
                      : "bg-accent text-accent-foreground"
                    : "bg-subtle text-muted"
              }`}
            >
              {done ? <Check size={12} className="anim-pop-in" /> : n}
            </span>
            <span className={`hidden text-xs sm:block ${active || done ? "text-surface-foreground" : "text-muted"}`}>
              {label}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <span className="h-px min-w-3 flex-1 bg-border">
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

function WizardItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function LiveStatus({
  code,
  online,
  opened,
  port,
}: {
  code: VtsBridgeCode | null;
  online: boolean;
  opened: boolean;
  port: number;
}) {
  if (!online) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-muted">
        {opened && <Loader2 size={14} className="animate-spin" />}
        {opened ? "Ждём, пока откроется страница…" : "Статус появится здесь автоматически."}
      </p>
    );
  }
  if (code === "blocked") {
    return (
      <Notice tone="danger" icon={ShieldAlert} title="Браузер запретил доступ к локальной сети">
        На странице подключения нажмите значок слева от адреса → «Доступ к локальной сети» → «Разрешить» и
        перезагрузите страницу.
      </Notice>
    );
  }
  if (code === "no-vts") {
    return (
      <Notice tone="warning" icon={AlertTriangle} title="VTube Studio не отвечает">
        Проверьте, что он запущен, включён «Start API (allow plugins)» и порт — {port}. Пробуем снова автоматически.
      </Notice>
    );
  }
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted">
      <Loader2 size={14} className="animate-spin" />
      {VTS_STATUS_TEXT[code ?? "connecting"] ?? "Подключаемся…"}
    </p>
  );
}

/* ---------------- Настройки моста ---------------- */

function SettingsModal({
  open,
  onClose,
  port,
  bridgeUrl,
  httpBridgeUrl,
  relayCommand,
  appPort,
  onSavePort,
  onReconnect,
}: {
  open: boolean;
  onClose: () => void;
  port: number;
  bridgeUrl: string;
  httpBridgeUrl: string;
  relayCommand: string;
  appPort: string;
  onSavePort: (port: number) => Promise<boolean>;
  onReconnect: () => void;
}) {
  const [portDraft, setPortDraft] = useState(String(port));
  const [copied, setCopied] = useState(false);
  const obsUrl = `${bridgeUrl}?obs=1`;

  async function copy() {
    await navigator.clipboard.writeText(obsUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={Settings2}
      title="Настройки моста"
      footer={<Button onClick={onClose}>Готово</Button>}
    >
      <div className="flex flex-col gap-6">
        <Field
          label="Ссылка для OBS → источник «Браузер»"
          hint="Любой размер, например 300×60. На стриме ничего не видно, пока всё в порядке. С ней не нужно держать открытой вкладку браузера."
        >
          <div className="flex items-center gap-2">
            <CodeBlock className="flex-1">{obsUrl}</CodeBlock>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Скопировано" : "Копировать"}
            </Button>
          </div>
        </Field>

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Порт API VTube Studio">
            <Input
              type="number"
              value={portDraft}
              onChange={(e) => setPortDraft(e.target.value)}
              className="w-32"
            />
          </Field>
          {Number(portDraft) !== port && (
            <Button size="sm" onClick={() => onSavePort(Number(portDraft))} className="mb-1">
              Сохранить порт
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onReconnect} className="mb-1">
            <RotateCcw size={12} /> Переподключить и заново запросить доступ
          </Button>
        </div>

        <details className="text-sm text-muted">
          <summary className="cursor-pointer select-none font-medium text-surface-foreground">
            Мост не видит VTube Studio?
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <p>
              OBS и VTube Studio должны быть запущены на одном компьютере, порт — совпадать с настройками VTube Studio.
              Если OBS не пускает https-страницу к локальному порту — используйте http-ссылку (порт {appPort} должен
              быть открыт на сервере):
            </p>
            <CodeBlock>{httpBridgeUrl}</CodeBlock>
            <p>Или запустите локальный релей на компьютере с VTube Studio (Node.js 22+):</p>
            <CodeBlock>{relayCommand}</CodeBlock>
          </div>
        </details>
      </div>
    </Modal>
  );
}

/* ---------------- Новый триггер ---------------- */

function TriggerModal({
  open,
  onClose,
  hotkeys,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  hotkeys: VtsHotkey[];
  onCreated: (trigger: VtsTriggerView) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Если выбранный хоткей пропал (сменили модель) — берём первый доступный.
  const hotkeyId = hotkeys.some((h) => h.hotkeyID === picked) ? picked : (hotkeys[0]?.hotkeyID ?? "");

  async function create() {
    const clean = name.trim().toLowerCase();
    if (!clean) {
      setError("Придумайте имя — его будут писать в чате");
      return;
    }
    setSaving(true);
    setError(null);
    const hotkey = hotkeys.find((h) => h.hotkeyID === hotkeyId);
    const res = await fetch("/api/vts/triggers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clean, hotkeyId, hotkeyLabel: hotkey ? hotkeyLabel(hotkey) : "" }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await errorText(res, "Не получилось создать триггер"));
      return;
    }
    onCreated(await res.json());
    setName("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Zap}
      iconTone="accent"
      title="Новый триггер"
      description="Свяжите хоткей модели с коротким именем для команды в чате."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={saving} onClick={create}>
            Добавить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Хоткей модели">
          <Select value={hotkeyId} onChange={(e) => setPicked(e.target.value)}>
            {hotkeys.map((h) => (
              <option key={h.hotkeyID} value={h.hotkeyID}>
                {hotkeyLabel(h)} ({h.type})
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Имя для чата"
          error={error}
          hint={name.trim() ? `Зрители напишут: !vts ${name.trim().toLowerCase()}` : "Например: wave, dance, angry"}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="wave"
            className="font-mono"
          />
        </Field>
      </div>
    </Modal>
  );
}
