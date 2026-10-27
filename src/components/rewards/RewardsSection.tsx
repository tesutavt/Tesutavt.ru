"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Gift,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Timer,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/Modal";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, EmptyState, Section } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";

export interface RewardView {
  id: string;
  twitchRewardId: string | null;
  title: string;
  cost: number;
  prompt: string;
  backgroundColor: string;
  isEnabled: boolean;
  isUserInputRequired: boolean;
  skipQueue: boolean;
  maxPerStream: number | null;
  maxPerUserPerStream: number | null;
  globalCooldownSeconds: number | null;
  lastSyncError: string | null;
}

type RewardDraft = Omit<RewardView, "id" | "twitchRewardId" | "lastSyncError">;

const EMPTY_DRAFT: RewardDraft = {
  title: "",
  cost: 500,
  prompt: "",
  backgroundColor: "#9147FF",
  isEnabled: true,
  isUserInputRequired: false,
  skipQueue: true,
  maxPerStream: null,
  maxPerUserPerStream: null,
  globalCooldownSeconds: null,
};

const COST_PRESETS = [100, 500, 1000, 5000, 10000];
const COLORS = ["#9147FF", "#FF4F4D", "#FF8A00", "#FFC700", "#00C88C", "#00A3FF", "#3D5AFE", "#FF5EBA", "#1F1F23"];
const COOLDOWNS: { label: string; value: number | null }[] = [
  { label: "Нет", value: null },
  { label: "30 с", value: 30 },
  { label: "1 мин", value: 60 },
  { label: "5 мин", value: 300 },
  { label: "15 мин", value: 900 },
  { label: "1 час", value: 3600 },
];

const TEMPLATES: { title: string; cost: number; prompt: string; color: string; input: boolean }[] = [
  { title: "Привет в чат", cost: 100, prompt: "Бот поздоровается с вами в чате", color: "#00C88C", input: false },
  { title: "Заказать трек", cost: 1000, prompt: "Напишите название или ссылку на YouTube", color: "#3D5AFE", input: true },
  { title: "Гидратация!", cost: 500, prompt: "Стример делает глоток воды", color: "#00A3FF", input: false },
  { title: "Вопрос стримеру", cost: 2000, prompt: "Задайте вопрос — отвечу на стриме", color: "#FF8A00", input: true },
];

const STEPS = ["Основное", "Правила", "Действие", "Проверка"];

/** Только редактируемые поля — ответ API содержит ещё graph и служебные. */
function toDraft(r: RewardView): RewardDraft {
  const keys = Object.keys(EMPTY_DRAFT) as (keyof RewardDraft)[];
  return Object.fromEntries(keys.map((k) => [k, r[k]])) as RewardDraft;
}

async function readError(res: Response) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? "Не получилось сохранить";
}

const nf = new Intl.NumberFormat("ru-RU");

function cooldownText(sec: number | null) {
  if (!sec) return null;
  if (sec < 60) return `${sec} с`;
  if (sec < 3600) return `${Math.round(sec / 60)} мин`;
  return `${Math.round(sec / 360) / 10} ч`;
}

export function RewardsSection({ initialRewards, disabled }: { initialRewards: RewardView[]; disabled: boolean }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [rewards, setRewards] = useState(initialRewards);
  const [wizard, setWizard] = useState<{ open: boolean; editing: RewardView | null; nonce: number }>({ open: false, editing: null, nonce: 0 });

  async function patch(reward: RewardView, body: Record<string, unknown>, success?: string) {
    const res = await fetch(`/api/rewards/${reward.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error(await readError(res));
      return null;
    }
    const updated = (await res.json()) as RewardView;
    setRewards((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    if (updated.lastSyncError) toast.warning("Сохранено, но Twitch не принял изменения", updated.lastSyncError);
    else if (success) toast.success(success);
    return updated;
  }

  async function remove(reward: RewardView) {
    const ok = await confirm({
      title: `Удалить «${reward.title}»?`,
      description: "Награда исчезнет и с Twitch, вместе с её Blueprint-графом.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/rewards/${reward.id}`, { method: "DELETE" });
    if (res.ok) {
      setRewards((prev) => prev.filter((x) => x.id !== reward.id));
      toast.success("Награда удалена");
    } else toast.error(await readError(res));
  }

  return (
    <Section
      title="Ваши награды"
      icon={Gift}
      description="Twitch даёт управлять только наградами, созданными этим сайтом — вручную созданные здесь не появятся."
      actions={
        <Button variant="accent" disabled={disabled} onClick={() => setWizard((w) => ({ open: true, editing: null, nonce: w.nonce + 1 }))}>
          <Plus size={16} /> Новая награда
        </Button>
      }
    >
      {rewards.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Наград пока нет"
          description="Мастер проведёт по шагам: название и цена, правила, что произойдёт при получении."
          action={
            <Button disabled={disabled} onClick={() => setWizard((w) => ({ open: true, editing: null, nonce: w.nonce + 1 }))}>
              <Plus size={16} /> Создать первую награду
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rewards.map((r) => (
            <RewardCard
              key={r.id}
              reward={r}
              onToggle={(isEnabled) =>
                patch(r, { isEnabled }, isEnabled ? "Награда включена на Twitch" : "Награда скрыта на Twitch")
              }
              onRetry={() => patch(r, { sync: true }, "Награда синхронизирована с Twitch")}
              onEdit={() => setWizard((w) => ({ open: true, editing: r, nonce: w.nonce + 1 }))}
              onDelete={() => remove(r)}
            />
          ))}
        </div>
      )}

      <RewardWizard
        key={wizard.nonce}
        open={wizard.open}
        editing={wizard.editing}
        onClose={() => setWizard((w) => ({ ...w, open: false }))}
        onSaved={(reward, created) => {
          setRewards((prev) => (created ? [...prev, reward] : prev.map((x) => (x.id === reward.id ? reward : x))));
        }}
        patch={patch}
      />
    </Section>
  );
}

function RewardCard({
  reward,
  onToggle,
  onRetry,
  onEdit,
  onDelete,
}: {
  reward: RewardView;
  onToggle: (enabled: boolean) => void;
  onRetry: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badges = [
    reward.isUserInputRequired && "с текстом",
    reward.skipQueue ? "сразу" : "в очередь",
    reward.maxPerStream && `${reward.maxPerStream} за стрим`,
    cooldownText(reward.globalCooldownSeconds) && `перезарядка ${cooldownText(reward.globalCooldownSeconds)}`,
  ].filter(Boolean) as string[];

  return (
    <Card className={`flex flex-col overflow-hidden transition-opacity ${reward.isEnabled ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3 p-4" style={{ background: `${reward.backgroundColor}1f` }}>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-card"
          style={{ background: reward.backgroundColor }}
        >
          <Gift size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{reward.title}</p>
          <p className="text-sm font-semibold tabular-nums">{nf.format(reward.cost)} баллов</p>
        </div>
        <Switch checked={reward.isEnabled} onChange={onToggle} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-3">
        {reward.prompt && <p className="line-clamp-2 text-sm text-muted">{reward.prompt}</p>}
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span key={b} className="rounded-full bg-subtle px-2 py-0.5 text-xs text-muted">
              {b}
            </span>
          ))}
          {!reward.twitchRewardId && (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger">не на Twitch</span>
          )}
        </div>

        {reward.lastSyncError && (
          <div className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-xs text-danger">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="flex-1">{reward.lastSyncError}</span>
            <button onClick={onRetry} className="flex shrink-0 items-center gap-1 font-medium hover:underline">
              <RefreshCw size={12} /> Повторить
            </button>
          </div>
        )}

        <div className="mt-auto flex items-center gap-1 pt-1">
          <Link href={`/dashboard/rewards/${reward.id}/blueprint`} className={buttonClass("secondary", "sm")}>
            <Workflow size={12} /> Действия
          </Link>
          <span className="flex-1" />
          <Button variant="ghost" size="icon" onClick={onEdit} title="Изменить">
            <Pencil size={16} />
          </Button>
          <Button variant="danger" size="icon" onClick={onDelete} title="Удалить">
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Мастер награды ---------------- */

function RewardWizard({
  open,
  editing,
  onClose,
  onSaved,
  patch,
}: {
  open: boolean;
  editing: RewardView | null;
  onClose: () => void;
  onSaved: (reward: RewardView, created: boolean) => void;
  patch: (reward: RewardView, body: Record<string, unknown>, success?: string) => Promise<RewardView | null>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<RewardDraft>(() => (editing ? toDraft(editing) : EMPTY_DRAFT));
  const [openBlueprint, setOpenBlueprint] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (p: Partial<RewardDraft>) => setDraft((d) => ({ ...d, ...p }));
  const isEdit = Boolean(editing);
  const last = STEPS.length - 1;

  function validate(s: number) {
    if (s === 0) {
      if (!draft.title.trim()) return "Придумайте название награды";
      if (!(draft.cost >= 1)) return "Стоимость — от 1 балла";
    }
    return null;
  }

  function next() {
    const err = validate(step);
    setError(err);
    if (!err) setStep((s) => Math.min(last, s + 1));
  }

  async function save() {
    const err = validate(0);
    if (err) {
      setError(err);
      setStep(0);
      return;
    }
    setSaving(true);
    setError(null);
    if (editing) {
      const updated = await patch(editing, draft, "Награда сохранена и отправлена на Twitch");
      setSaving(false);
      if (updated) {
        onSaved(updated, false);
        onClose();
      }
      return;
    }
    const res = await fetch("/api/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const reward = (await res.json()) as RewardView;
    onSaved(reward, true);
    if (reward.lastSyncError) toast.warning("Награда сохранена, но Twitch её не принял", reward.lastSyncError);
    else toast.success(`Награда «${reward.title}» появилась на Twitch`);
    onClose();
    if (openBlueprint) router.push(`/dashboard/rewards/${reward.id}/blueprint`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={isEdit ? Pencil : Sparkles}
      iconTone="accent"
      title={isEdit ? `Награда «${editing!.title}»` : "Новая награда"}
      description={isEdit ? "Изменения сразу отправятся на Twitch." : "Четыре коротких шага — и награда появится на канале."}
      footer={
        <>
          {step > 0 && !isEdit && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="mr-auto">
              <ArrowLeft size={16} /> Назад
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          {isEdit || step === last ? (
            <Button variant="accent" loading={saving} onClick={save}>
              {isEdit ? "Сохранить" : (
                <>
                  <Check size={16} /> Создать на Twitch
                </>
              )}
            </Button>
          ) : (
            <Button onClick={next}>
              Дальше <ArrowRight size={16} />
            </Button>
          )}
        </>
      }
    >
      <ol className="mb-5 flex gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <button
              onClick={() => (isEdit || i < step ? setStep(i) : undefined)}
              disabled={!isEdit && i > step}
              className="flex w-full flex-col gap-1.5 text-left disabled:cursor-default"
            >
              <span className="h-1 overflow-hidden rounded-full bg-subtle">
                <span
                  className="block h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: i <= step ? "100%" : "0%" }}
                />
              </span>
              <span className={`text-xs ${i === step ? "font-medium text-surface-foreground" : "text-muted"}`}>
                {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div key={step} className="anim-dialog-in">
        {step === 0 && (
          <div className="grid gap-5 md:grid-cols-[1fr_200px]">
            <div className="flex flex-col gap-4">
              {!isEdit && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium">Быстрый старт</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.title}
                        onClick={() =>
                          set({
                            title: t.title,
                            cost: t.cost,
                            prompt: t.prompt,
                            backgroundColor: t.color,
                            isUserInputRequired: t.input,
                          })
                        }
                        className="rounded-full border border-border px-3 py-1 text-xs transition hover:border-accent hover:text-accent"
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Field label={`Название · ${draft.title.length}/45`}>
                <Input
                  value={draft.title}
                  maxLength={45}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="Сказать привет"
                />
              </Field>
              <Field label="Стоимость в баллах канала">
                <div className="flex flex-wrap items-center gap-1.5">
                  {COST_PRESETS.map((c) => (
                    <Chip key={c} active={draft.cost === c} onClick={() => set({ cost: c })}>
                      {nf.format(c)}
                    </Chip>
                  ))}
                  <Input
                    type="number"
                    min={1}
                    value={draft.cost}
                    onChange={(e) => set({ cost: Number(e.target.value) })}
                    className="w-28"
                  />
                </div>
              </Field>
              <Field label={`Описание · ${draft.prompt.length}/200`} hint="Видно зрителю в окне награды.">
                <Textarea
                  rows={2}
                  maxLength={200}
                  value={draft.prompt}
                  onChange={(e) => set({ prompt: e.target.value })}
                  placeholder="Что получит зритель"
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">Цвет</span>
                <div className="flex flex-wrap items-center gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => set({ backgroundColor: c })}
                      aria-label={c}
                      className={`h-7 w-7 rounded-full transition ${
                        draft.backgroundColor.toUpperCase() === c ? "scale-110 ring-2 ring-accent ring-offset-2 ring-offset-surface" : "hover:scale-110"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={draft.backgroundColor}
                    onChange={(e) => set({ backgroundColor: e.target.value })}
                    className="h-7 w-10 cursor-pointer rounded-md border border-border bg-transparent"
                    title="Свой цвет"
                  />
                </div>
              </div>
            </div>
            <RewardPreview draft={draft} />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <ToggleRow
              icon={MessageSquareText}
              title="Зритель пишет текст"
              text="Например, вопрос или название трека. Текст доступен в Blueprint."
              checked={draft.isUserInputRequired}
              onChange={(v) => set({ isUserInputRequired: v })}
            />
            <ToggleRow
              icon={Zap}
              title="Выполнять сразу"
              text="Иначе награда ждёт подтверждения в очереди запросов на Twitch."
              checked={draft.skipQueue}
              onChange={(v) => set({ skipQueue: v })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Лимит за стрим" hint="Пусто — без лимита.">
                <Input
                  type="number"
                  min={0}
                  value={draft.maxPerStream ?? ""}
                  placeholder="без лимита"
                  onChange={(e) => set({ maxPerStream: Number(e.target.value) > 0 ? Number(e.target.value) : null })}
                />
              </Field>
              <Field label="Лимит на одного зрителя за стрим" hint="Пусто — без лимита.">
                <Input
                  type="number"
                  min={0}
                  value={draft.maxPerUserPerStream ?? ""}
                  placeholder="без лимита"
                  onChange={(e) =>
                    set({ maxPerUserPerStream: Number(e.target.value) > 0 ? Number(e.target.value) : null })
                  }
                />
              </Field>
            </div>
            <Field label="Перезарядка между получениями">
              <div className="flex flex-wrap items-center gap-1.5">
                {COOLDOWNS.map((c) => (
                  <Chip
                    key={c.label}
                    active={draft.globalCooldownSeconds === c.value}
                    onClick={() => set({ globalCooldownSeconds: c.value })}
                  >
                    <Timer size={12} /> {c.label}
                  </Chip>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Когда зритель получит награду, сайт может что-то сделать автоматически: написать в чат, запустить анимацию
              VTube Studio, добавить трек, записать данные зрителя. Это настраивается в визуальном редакторе действий
              (Blueprint).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                active={openBlueprint}
                onClick={() => setOpenBlueprint(true)}
                icon={Workflow}
                title="Настроить действия"
                text="Сразу после создания откроется редактор."
              />
              <ChoiceCard
                active={!openBlueprint}
                onClick={() => setOpenBlueprint(false)}
                icon={Gift}
                title="Только награда"
                text="Выполните её сами на стриме. Действия можно добавить позже."
              />
            </div>
            <p className="text-xs text-muted">Действия выполняются, пока на вкладке «Бот» включён бот.</p>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 md:grid-cols-[1fr_200px]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <Summary label="Название">{draft.title}</Summary>
              <Summary label="Стоимость">{nf.format(draft.cost)} баллов</Summary>
              <Summary label="Описание">{draft.prompt || "—"}</Summary>
              <Summary label="Текст от зрителя">{draft.isUserInputRequired ? "да" : "нет"}</Summary>
              <Summary label="Выполнение">{draft.skipQueue ? "сразу" : "через очередь запросов"}</Summary>
              <Summary label="Лимиты">
                {[
                  draft.maxPerStream && `${draft.maxPerStream} за стрим`,
                  draft.maxPerUserPerStream && `${draft.maxPerUserPerStream} на зрителя`,
                ]
                  .filter(Boolean)
                  .join(", ") || "без лимитов"}
              </Summary>
              <Summary label="Перезарядка">{cooldownText(draft.globalCooldownSeconds) ?? "нет"}</Summary>
              <Summary label="Дальше">{openBlueprint ? "откроется редактор действий" : "только награда"}</Summary>
            </dl>
            <RewardPreview draft={draft} />
          </div>
        )}

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

function RewardPreview({ draft }: { draft: RewardDraft }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="self-start text-xs font-medium text-muted">Так увидят зрители</span>
      <div className="w-full overflow-hidden rounded-card border border-border bg-[#18181b] text-white">
        <div
          className="flex h-24 items-center justify-center transition-colors duration-300"
          style={{ background: draft.backgroundColor }}
        >
          <Gift size={36} className="anim-pop-in" />
        </div>
        <div className="flex flex-col gap-1 p-3">
          <p className="truncate text-sm font-semibold">{draft.title || "Название награды"}</p>
          <p className="line-clamp-2 min-h-[2rem] text-xs text-white/60">{draft.prompt || "Описание награды"}</p>
          <span className="mt-1 self-start rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold tabular-nums">
            {nf.format(draft.cost || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition ${
        active ? "bg-ink text-ink-foreground" : "bg-subtle hover:bg-border"
      }`}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  text,
  checked,
  onChange,
}: {
  icon: typeof Gift;
  title: string;
  text: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-card border border-border p-3 transition hover:bg-subtle">
      <Icon size={18} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{text}</span>
      </span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon: Icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Gift;
  title: string;
  text: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-card border-2 p-4 text-left transition ${
        active ? "border-accent bg-accent-soft" : "border-border hover:border-muted"
      }`}
    >
      <span className="flex items-center justify-between">
        <Icon size={20} className={active ? "text-accent" : "text-muted"} />
        {active && <Check size={16} className="anim-pop-in text-accent" />}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted">{text}</span>
    </button>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </>
  );
}
