import { Database, MessageSquareText, Users } from "lucide-react";
import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { seedViewerFields } from "@/lib/viewer-data";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Card, IconTile } from "@/components/ui/Card";
import { ViewerFieldsSection } from "@/components/viewers/ViewerFieldsSection";
import { ViewerDataSection } from "@/components/viewers/ViewerDataSection";
import { ViewersTabs } from "@/components/viewers/ViewersTabs";

const COMMANDS: { cmd: string; text: string }[] = [
  { cmd: "!set city Москва", text: "запомнить значение" },
  { cmd: "!set birthday 15.02", text: "дата, год можно не писать" },
  { cmd: "!get city", text: "посмотреть своё (или !get @ник)" },
  { cmd: "!unset city", text: "забыть значение" },
];

export default async function ViewersPage() {
  const session = await panelSession();
  const userId = session!.user.id;

  await seedViewerFields(userId);
  const [fields, viewerGroups, valueCount] = await Promise.all([
    prisma.viewerField.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.viewerData.groupBy({ by: ["viewerLogin"], where: { userId } }),
    prisma.viewerData.count({ where: { userId } }),
  ]);
  const enabledFields = fields.filter((f) => f.enabled).length;

  return (
    <Page>
      <PageHeader page="viewers" />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Stat icon={Users} value={viewerGroups.length} label="зрителей с данными" />
          <Stat icon={Database} value={valueCount} label="значений сохранено" />
          <Stat icon={MessageSquareText} value={enabledFields} label={`полей из ${fields.length} включено`} />
        </div>
        <Card className="flex flex-col gap-3 p-5">
          <p className="font-medium">Как это работает</p>
          <p className="text-sm text-muted">
            Зрители сами рассказывают о себе командами в чате, а бот использует это в ответах:{" "}
            <code className="font-mono text-surface-foreground">{"{viewer.city}"}</code> в тексте команды или блоки
            «Данные зрителя» в Blueprint.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {COMMANDS.map((c) => (
              <li key={c.cmd} className="rounded-control bg-subtle px-3 py-2">
                <code className="block font-mono text-sm">{c.cmd}</code>
                <span className="text-xs text-muted">{c.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Команды !set / !get / !unset можно выключить или ограничить по ролям на вкладке «Бот».</p>
        </Card>
      </div>

      <ViewersTabs
        viewerCount={viewerGroups.length}
        fieldCount={fields.length}
        viewers={<ViewerDataSection fieldLabels={Object.fromEntries(fields.map((f) => [f.key, f.label]))} />}
        fields={
          <ViewerFieldsSection
            initialFields={fields.map((f) => ({
              id: f.id,
              key: f.key,
              label: f.label,
              type: f.type,
              aliases: f.aliases,
              maxLength: f.maxLength,
              enabled: f.enabled,
            }))}
          />
        }
      />
    </Page>
  );
}

function Stat({ icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <IconTile icon={icon} tone="accent" />
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
      </div>
    </Card>
  );
}
