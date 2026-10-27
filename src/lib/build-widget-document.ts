import { buildSampleChannel } from "@/lib/twitch-fields";

interface BuildWidgetDocumentOptions {
  html: string;
  css: string;
  js: string;
  fieldValues: Record<string, unknown>;
  /** overlayToken холста — доступен встроенным пресетам (например
   *  music-player) как window.widget.overlayToken для обращения к
   *  публичным /api/public/music/[token]/* эндпоинтам. */
  overlayToken?: string | null;
  /** Настоящие данные канала (follower count и т.д.) на реальном оверлее -
   *  см. lib/twitch-channel.ts resolveWidgetChannel(). В редакторе не
   *  передаётся - используется buildSampleChannel(). */
  channel?: Record<string, unknown> | null;
}

/**
 * Собирает самодостаточный HTML-документ для sandboxed iframe.
 *
 * Рантайм-контракт для виджет-скриптов:
 * - `window.widget.fields` — текущие значения полей (Fields tab)
 * - `window.widget.channel` — снэпшот данных канала. На реальном оверлее —
 *   настоящие данные Twitch Helix (см. resolveWidgetChannel), в редакторе —
 *   моковые из twitch-fields.ts. Обновляется на лету на реальном оверлее
 *   (см. OverlayLiveEvents.tsx, опрашивает раз в несколько секунд) — виджет
 *   может определить `window.onChannelUpdate(channel)`, чтобы среагировать
 *   на обновление (например перерисовать прогресс-бар фолловеров).
 * - `window.widget.overlayToken` — публичный токен холста, на котором стоит
 *   элемент (null в редакторе, если холст ещё не сохранён)
 * - `window.widget.vts.trigger(name)` — запускает именованный триггер
 *   VTube Studio (настраивается во вкладке VTube Studio в дашборде) из
 *   JS любого виджета, без прямого подключения к VTube Studio из этого
 *   виджета — фактическое подключение держит отдельный виджет-мост
 *   (пресет "VTube Studio (мост)"), этот вызов просто ставит триггер в
 *   очередь событий оверлея (тот же канал, что у chatMessage).
 * - `window.onWidgetEvent(type, data)` — опциональный хук, который виджет
 *   может определить, чтобы реагировать на события Twitch (follow, subscribe,
 *   cheer, raid, chatMessage). Вызывается и из live-preview ("Test event"),
 *   и на реальном оверлее — там события приходят поллингом
 *   (/api/public/overlay/[token]/events, см. OverlayLiveEvents.tsx) и
 *   разносятся по виджетам тем же postMessage-каналом, что и тестовые.
 *   Пока по-настоящему живой источник только у chatMessage (см.
 *   lib/bot/manager.ts) — follow/subscribe/cheer/raid ещё не подключены
 *   к реальным подпискам EventSub.
 */
export function buildWidgetDocument({
  html,
  css,
  js,
  fieldValues,
  overlayToken = null,
  channel: realChannel = null,
}: BuildWidgetDocumentOptions): string {
  const channel = realChannel ?? buildSampleChannel();

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>${css}</style>
</head>
<body>
${html}
<script>
  window.widget = { fields: ${JSON.stringify(fieldValues)}, channel: ${JSON.stringify(channel)}, overlayToken: ${JSON.stringify(overlayToken)} };
  window.widget.vts = {
    trigger: function (nameOrHotkeyId, isHotkeyId) {
      if (!window.widget.overlayToken) return Promise.resolve(false);
      var body = isHotkeyId ? { hotkeyId: nameOrHotkeyId } : { name: nameOrHotkeyId };
      return fetch('/api/public/overlay/' + window.widget.overlayToken + '/vts/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    },
  };
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.__vtubeTestEvent && typeof window.onWidgetEvent === 'function') {
      window.onWidgetEvent(e.data.type, e.data.data);
    } else if (e.data.__vtubeChannelUpdate) {
      window.widget.channel = e.data.channel;
      if (typeof window.onChannelUpdate === 'function') window.onChannelUpdate(e.data.channel);
    }
  });
  try {
${js}
  } catch (err) {
    console.error('Widget JS error:', err);
  }
</script>
</body>
</html>`;
}
