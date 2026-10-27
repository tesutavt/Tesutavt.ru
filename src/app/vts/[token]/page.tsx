import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VtsBridge } from "@/components/vts/VtsBridge";

export const metadata = { title: "Подключение VTube Studio — VtubeOverlay" };

// Страница-мост VTube Studio: открывается во вкладке браузера (мастер
// подключения в дашборде) или добавляется в OBS как Browser Source.
export default async function VtsBridgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const connection = await prisma.vtsConnection.findUnique({ where: { bridgeToken: token }, select: { id: true } });
  if (!connection) notFound();

  return (
    <>
      {/* В OBS фон должен быть прозрачным; в браузере VtsBridge рисует свой фон поверх. */}
      <style>{`html, body { background: transparent !important; margin: 0; overflow: hidden; }`}</style>
      <VtsBridge token={token} />
    </>
  );
}
