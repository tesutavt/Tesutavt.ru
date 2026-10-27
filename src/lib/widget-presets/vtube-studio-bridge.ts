import type { WidgetPreset } from "@/lib/widget-types";

// VTube Studio крутит свой WebSocket-сервер на компьютере СТРИМЕРА
// (ws://localhost:8001 по умолчанию) — сервер приложения физически не
// может до него достучаться. Поэтому вся логика подключения живёт здесь,
// в браузере (в OBS, на том же ПК, где запущен и сам VTS). Сам виджет
// ничего не показывает (кроме опционального статуса для отладки) — просто
// слушает vtsTrigger-события (см. window.onWidgetEvent) и дёргает
// HotkeyTriggerRequest у VTS.
//
// Устарел: теперь мостом служит отдельная страница /vts/[bridgeToken]
// (ссылка — во вкладке VTube Studio в дашборде), добавлять её через
// редактор не нужно. Пресет скрыт из меню и оставлен только для того,
// чтобы уже добавленные на холст элементы продолжали узнаваться.
export const vtubeStudioBridgePreset: WidgetPreset = {
  id: "vtube-studio-bridge",
  hidden: true,
  name: "VTube Studio (мост)",
  description: "Невидимый виджет-мост: получает команды из оверлея/чата и дёргает хоткеи в VTube Studio",
  width: 260,
  height: 60,
  fieldsSchema: [{ key: "showStatus", label: "Показывать статус подключения", type: "boolean", default: true }],
  html: `<div id="vtsStatus" class="vts-status">VTube Studio: ...</div>`,
  css: `body { margin: 0; font-family: system-ui, sans-serif; }
.vts-status {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0,0,0,0.65);
  color: #fff;
  font-size: 11px;
  line-height: 1.4;
}`,
  js: `(function () {
  var TOKEN = window.widget.overlayToken;
  var fields = window.widget.fields;
  var PLUGIN_NAME = 'VtubeOverlay';
  var PLUGIN_DEVELOPER = 'VtubeOverlay';

  var ws = null;
  var port = 8001;
  var authToken = null;
  var authenticated = false;
  var reconnectAttempt = 0;
  var pendingHotkeys = [];

  var statusEl = document.getElementById('vtsStatus');

  function setStatus(text) {
    if (!fields.showStatus) { statusEl.style.display = 'none'; return; }
    statusEl.style.display = '';
    statusEl.textContent = 'VTube Studio: ' + text;
  }

  function requestId() {
    return 'req' + Math.random().toString(36).slice(2);
  }

  function send(messageType, data) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({
      apiName: 'VTubeStudioPublicAPI',
      apiVersion: '1.0',
      requestID: requestId(),
      messageType: messageType,
      data: data || {},
    }));
  }

  function connect() {
    if (!TOKEN) { setStatus('нет overlayToken (сохраните виджет)'); return; }
    fetch('/api/public/overlay/' + TOKEN + '/vts', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        port = cfg.port || 8001;
        authToken = cfg.authToken || null;
        openSocket();
      })
      .catch(function () {
        setStatus('не удалось получить настройки подключения');
        scheduleReconnect();
      });
  }

  function openSocket() {
    setStatus('подключение (порт ' + port + ')...');
    if (location.protocol === 'https:') {
      // ws:// с https-страницы браузер блокирует как mixed content -
      // VTube Studio не отдаёт wss://. В проде нужен локальный релей
      // (tools/vts-relay.js на этом же ПК) вместо прямого подключения из
      // браузера - он не браузер, mixed content его не касается.
      setStatus(authToken ? 'токен уже есть, но эта страница на https — откройте источник в OBS по http (см. вкладку VTube Studio в дашборде)' : 'откройте источник по http:// (ссылка — во вкладке VTube Studio в дашборде), либо запустите tools/vts-relay.js');
      setTimeout(connect, 10000);
      return;
    }
    try {
      // 127.0.0.1, а не "localhost" - надёжнее резолвится в некоторых
      // встроенных браузерах (OBS Browser Source и т.п.).
      ws = new WebSocket('ws://127.0.0.1:' + port);
    } catch (e) {
      setStatus('не удалось открыть соединение');
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      reconnectAttempt = 0;
      authenticated = false;
      if (authToken) {
        send('AuthenticationRequest', {
          pluginName: PLUGIN_NAME,
          pluginDeveloper: PLUGIN_DEVELOPER,
          authenticationToken: authToken,
        });
      } else {
        requestNewToken();
      }
    };

    ws.onmessage = function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      handleMessage(msg);
    };

    ws.onclose = function () {
      authenticated = false;
      setStatus('соединение закрыто, переподключение...');
      scheduleReconnect();
    };
  }

  function requestNewToken() {
    setStatus('откройте VTube Studio и нажмите "Allow" во всплывающем окне...');
    send('AuthenticationTokenRequest', { pluginName: PLUGIN_NAME, pluginDeveloper: PLUGIN_DEVELOPER });
  }

  function handleMessage(msg) {
    var type = msg.messageType;
    var data = msg.data || {};

    if (type === 'AuthenticationTokenResponse') {
      authToken = data.authenticationToken;
      // Сохраняем на сервере, чтобы не спрашивать разрешение заново при
      // каждой перезагрузке источника в OBS.
      fetch('/api/public/overlay/' + TOKEN + '/vts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authToken: authToken }),
      }).catch(function () {});
      send('AuthenticationRequest', {
        pluginName: PLUGIN_NAME,
        pluginDeveloper: PLUGIN_DEVELOPER,
        authenticationToken: authToken,
      });
    } else if (type === 'AuthenticationResponse') {
      authenticated = !!data.authenticated;
      setStatus(authenticated ? 'подключено' : 'авторизация не удалась (' + (data.reason || '') + ')');
      if (authenticated) flushPendingHotkeys();
    } else if (type === 'APIError') {
      // errorID 50 = юзер отклонил запрос токена, 51 = токен недействителен/отозван.
      if (data.errorID === 50 || data.errorID === 51) {
        authToken = null;
      }
      setStatus('ошибка VTS: ' + (data.message || data.errorID));
    }
  }

  function scheduleReconnect() {
    reconnectAttempt++;
    var delay = Math.min(30000, 2000 * reconnectAttempt);
    setTimeout(connect, delay);
  }

  function triggerHotkey(hotkeyId) {
    if (!hotkeyId) return;
    if (!authenticated) { pendingHotkeys.push(hotkeyId); return; }
    send('HotkeyTriggerRequest', { hotkeyID: hotkeyId });
  }

  function flushPendingHotkeys() {
    var queue = pendingHotkeys;
    pendingHotkeys = [];
    queue.forEach(triggerHotkey);
  }

  // Сюда прилетают события с реального оверлея (см. lib/bot/manager.ts,
  // команда !vts) - тем же postMessage-каналом, что и "Test event" в
  // редакторе.
  window.onWidgetEvent = function (type, data) {
    if (type === 'vtsTrigger' && data && data.hotkeyId) {
      triggerHotkey(data.hotkeyId);
    }
  };

  connect();
})();`,
};
