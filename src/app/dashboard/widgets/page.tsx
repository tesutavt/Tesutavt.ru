import { panelSession } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { CreateWidgetModal } from "@/components/widgets/CreateWidgetModal";
import { WidgetCard } from "@/components/widgets/WidgetCard";
import { LayoutGrid } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";

export default async function WidgetsPage() {
  const session = await panelSession();
  const widgets = await prisma.widget.findMany({
    where: { userId: session!.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { elements: true } } },
  });

  const totalElements = widgets.reduce((sum, w) => sum + w._count.elements, 0);

  return (
    <Page>
      <PageHeader page="widgets" actions={<CreateWidgetModal />} />

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Card className="p-5">
          <div className="text-3xl font-bold">{widgets.length}</div>
          <div className="text-sm text-muted">Виджетов создано</div>
        </Card>
        <Card className="p-5">
          <div className="text-3xl font-bold">{totalElements}</div>
          <div className="text-sm text-muted">Элементов всего</div>
        </Card>
      </div>

      {widgets.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="У вас пока нет виджетов"
          description="Нажмите «Создать виджет», чтобы начать."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              id={widget.id}
              name={widget.name}
              canvasWidth={widget.canvasWidth}
              canvasHeight={widget.canvasHeight}
              elementCount={widget._count.elements}
              overlayToken={widget.overlayToken}
              updatedAt={widget.updatedAt.toISOString()}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
