#!/usr/bin/env node
// Локальный релей VTube Studio для продакшена.
//
// Проблема: VTube Studio отдаёт только ws:// (без TLS) на localhost. Если
// оверлей открыт в OBS по https:// (обязательно в продакшене — домен,
// OAuth и т.д.), браузер блокирует ws://localhost как mixed content —
// подключиться напрямую из виджета не выйдет.
//
// Решение: этот скрипт — обычный Node-процесс (не браузер, поэтому
// mixed-content его не касается). Он опрашивает тот же публичный
// эндпоинт событий, что и оверлей, и при получении vtsTrigger дёргает
// хоткей в VTube Studio напрямую по ws://127.0.0.1:PORT. Запускается один
// раз на стриминг-ПК рядом с OBS/VTS, работать может даже свёрнутым в фоне.
//
// Использование:
//   node vts-relay.js --url https://your-site.com --token <token> [--vts-port 8001]
//
// token — готовая команда есть во вкладке VTube Studio в дашборде
// (bridgeToken; overlayToken любого холста тоже подойдёт).

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const SITE_URL = (arg("url", "") || "").replace(/\/$/, "");
const OVERLAY_TOKEN = arg("token", "");
const VTS_PORT = Number(arg("vts-port", "8001"));
const TOKEN_FILE = new URL("./.vts-relay-token.json", import.meta.url);

if (!SITE_URL || !OVERLAY_TOKEN) {
  console.error("Использование: node vts-relay.js --url https://your-site.com --token <overlayToken>");
  process.exit(1);
}

const PLUGIN_NAME = "VtubeOverlayRelay";
const PLUGIN_DEVELOPER = "VtubeOverlay";

let ws = null;
let authToken = null;
let authenticated = false;
// null — первый опрос: только запоминаем позицию, старые триггеры из
// буфера сервера не проигрываем.
let sinceSeq = null;
let pendingHotkeys = [];

async function loadToken() {
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(TOKEN_FILE, "utf8");
    authToken = JSON.parse(raw).authToken || null;
  } catch {
    authToken = null;
  }
}

async function saveToken(token) {
  authToken = token;
  try {
    const fs = await import("node:fs/promises");
    await fs.writeFile(TOKEN_FILE, JSON.stringify({ authToken: token }), "utf8");
  } catch (e) {
    console.error("Не удалось сохранить токен на диск:", e.message);
  }
  // На сервер токен не отправляем: он выдан плагину "VtubeOverlayRelay" и
  // не подойдёт странице-мосту (у неё своё имя плагина).
}

function reportStatus(status, extra) {
  fetch(`${SITE_URL}/api/public/overlay/${OVERLAY_TOKEN}/vts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, ...extra }),
  }).catch(() => {});
}

function send(messageType, data) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(
    JSON.stringify({
      apiName: "VTubeStudioPublicAPI",
      apiVersion: "1.0",
      requestID: "req" + Math.random().toString(36).slice(2),
      messageType,
      data: data || {},
    })
  );
}

function connectVts() {
  console.log(`[vts] подключение к VTube Studio на 127.0.0.1:${VTS_PORT}...`);
  ws = new WebSocket(`ws://127.0.0.1:${VTS_PORT}`);

  ws.onopen = () => {
    if (authToken) {
      send("AuthenticationRequest", { pluginName: PLUGIN_NAME, pluginDeveloper: PLUGIN_DEVELOPER, authenticationToken: authToken });
    } else {
      console.log('[vts] нет сохранённого токена — откройте VTube Studio и нажмите "Allow" во всплывающем окне');
      reportStatus("waiting-approval");
      send("AuthenticationTokenRequest", { pluginName: PLUGIN_NAME, pluginDeveloper: PLUGIN_DEVELOPER });
    }
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    handleVtsMessage(msg);
  };

  ws.onclose = () => {
    authenticated = false;
    reportStatus("no-vts");
    console.log("[vts] соединение закрыто, переподключение через 3с...");
    setTimeout(connectVts, 3000);
  };

  ws.onerror = () => {};
}

function handleVtsMessage(msg) {
  const type = msg.messageType;
  const data = msg.data || {};

  if (type === "AuthenticationTokenResponse") {
    saveToken(data.authenticationToken);
    send("AuthenticationRequest", { pluginName: PLUGIN_NAME, pluginDeveloper: PLUGIN_DEVELOPER, authenticationToken: data.authenticationToken });
  } else if (type === "AuthenticationResponse") {
    authenticated = !!data.authenticated;
    console.log(authenticated ? "[vts] авторизовано, готов к работе" : `[vts] авторизация не удалась: ${data.reason}`);
    if (authenticated) {
      reportStatus("connected");
      send("HotkeysInCurrentModelRequest");
      send("EventSubscriptionRequest", { eventName: "ModelLoadedEvent", subscribe: true, config: {} });
      const queue = pendingHotkeys;
      pendingHotkeys = [];
      queue.forEach(triggerHotkey);
    } else {
      // Токен отозван в VTS — запрашиваем новый.
      authToken = null;
      reportStatus("waiting-approval");
      send("AuthenticationTokenRequest", { pluginName: PLUGIN_NAME, pluginDeveloper: PLUGIN_DEVELOPER });
    }
  } else if (type === "HotkeysInCurrentModelResponse") {
    const list = (data.availableHotkeys || []).map((h) => ({ hotkeyID: h.hotkeyID, name: h.name, type: h.type }));
    console.log(`[vts] получено хоткеев: ${list.length} — отправляю на сервер`);
    reportStatus("connected", { hotkeys: list });
  } else if (type === "ModelLoadedEvent") {
    send("HotkeysInCurrentModelRequest");
  } else if (type === "APIError") {
    if (data.errorID === 50 || data.errorID === 8) authToken = null;
    console.error("[vts] ошибка:", data.message || data.errorID);
  }
}

function triggerHotkey(hotkeyId) {
  if (!authenticated) {
    pendingHotkeys.push(hotkeyId);
    return;
  }
  console.log("[vts] триггерим хоткей", hotkeyId);
  send("HotkeyTriggerRequest", { hotkeyID: hotkeyId });
}

async function pollEvents() {
  try {
    const res = await fetch(`${SITE_URL}/api/public/overlay/${OVERLAY_TOKEN}/events?since=${sinceSeq ?? 0}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const body = await res.json();
      for (const event of sinceSeq === null ? [] : body.events) {
        if (event.type === "vtsTrigger" && event.data && event.data.hotkeyId) {
          triggerHotkey(event.data.hotkeyId);
        } else if (event.type === "vtsRefreshHotkeys") {
          send("HotkeysInCurrentModelRequest");
        }
      }
      sinceSeq = body.latestSeq;
    }
  } catch (e) {
    console.error("[relay] ошибка опроса сервера:", e.message);
  } finally {
    setTimeout(pollEvents, 1500);
  }
}

await loadToken();
connectVts();
pollEvents();
console.log(`[relay] запущен для ${SITE_URL}, overlayToken=${OVERLAY_TOKEN}`);
