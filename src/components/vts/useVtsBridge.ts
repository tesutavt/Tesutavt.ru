"use client";

import { useEffect, useState } from "react";
import { BRIDGE_HEARTBEAT_MS, type VtsBridgeCode } from "@/components/vts/vts-status";

const PLUGIN_NAME = "VtubeOverlay";
const PLUGIN_DEVELOPER = "VtubeOverlay";
const EVENTS_POLL_MS = 1000;

interface VtsHotkey {
  hotkeyID: string;
  name: string;
  type: string;
  file?: string;
}

export interface VtsBridgeState {
  code: VtsBridgeCode;
  /** Подробный текст для отладки (?debug=1 в OBS). */
  detail: string;
  port: number;
  model: string | null;
  hotkeyCount: number | null;
}

/**
 * Мост между сервером и VTube Studio. VTS слушает ws://127.0.0.1:8001 на
 * компьютере стримера — сервер до него не достанет, поэтому подключается
 * страница, открытая на том же ПК (в OBS или во вкладке браузера).
 *
 * - авторизуется (токен хранится на сервере — "Allow" в VTS нужен один раз);
 * - присылает на сервер список хоткеев текущей модели (и заново при смене
 *   модели / по кнопке в дашборде);
 * - шлёт статус + heartbeat, чтобы дашборд показывал, что мост жив;
 * - опрашивает очередь событий и дёргает HotkeyTriggerRequest на vtsTrigger.
 *
 * active = false — страница открыта, но подключаться ещё нельзя (ждём
 * нажатия «Подключить», чтобы запрос разрешения браузера был понятен
 * пользователю): шлём только heartbeat со статусом waiting-click.
 */
export function useVtsBridge(token: string, active: boolean): VtsBridgeState {
  const [state, setState] = useState<VtsBridgeState>({
    code: active ? "connecting" : "waiting-click",
    detail: "запуск...",
    port: 8001,
    model: null,
    hotkeyCount: null,
  });

  useEffect(() => {
    const api = `/api/public/overlay/${token}/vts`;
    let stopped = false;
    let lastReported = "";

    function post(body: Record<string, unknown>) {
      fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }

    if (!active) {
      // active меняется только false → true, так что начальное состояние
      // (waiting-click) уже верное — здесь только сообщаем серверу.
      post({ status: "waiting-click" });
      const idleHeartbeat = setInterval(() => post({ status: "waiting-click" }), BRIDGE_HEARTBEAT_MS);
      return () => clearInterval(idleHeartbeat);
    }

    let ws: WebSocket | null = null;
    let port = 8001;
    let authToken: string | null = null;
    let authenticated = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingHotkeys: string[] = [];

    function report(code: VtsBridgeCode, detail: string, extra?: Record<string, unknown>) {
      setState((s) => ({ ...s, code, detail, port }));
      if (code === lastReported && !extra) return;
      lastReported = code;
      post({ status: code, ...extra });
    }

    function send(messageType: string, data?: Record<string, unknown>) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          apiName: "VTubeStudioPublicAPI",
          apiVersion: "1.0",
          requestID: "req" + Math.random().toString(36).slice(2),
          messageType,
          data: data ?? {},
        })
      );
    }

    async function connect() {
      if (stopped) return;
      try {
        const cfg = (await fetch(api, { cache: "no-store" }).then((r) => r.json())) as {
          port: number;
          authToken: string | null;
        };
        port = cfg.port || 8001;
        authToken = cfg.authToken;
      } catch {
        setState((s) => ({ ...s, detail: "не удалось получить настройки с сервера" }));
        scheduleReconnect();
        return;
      }
      openSocket();
    }

    async function localNetworkBlocked() {
      // Chrome 142+ спрашивает разрешение на доступ https-страницы к
      // локальной сети. Имя разрешения менялось — пробуем оба.
      for (const name of ["local-network-access", "local-network"]) {
        try {
          const status = await navigator.permissions.query({ name } as unknown as PermissionDescriptor);
          return status.state === "denied";
        } catch {
          // браузер не знает такого разрешения
        }
      }
      return false;
    }

    function openSocket() {
      report("connecting", `подключение к 127.0.0.1:${port}...`);
      try {
        // 127.0.0.1, а не "localhost" — надёжнее в OBS Browser Source.
        ws = new WebSocket(`ws://127.0.0.1:${port}`);
      } catch {
        report("no-vts", "не удалось открыть соединение");
        scheduleReconnect();
        return;
      }
      const socket = ws;

      socket.onopen = () => {
        reconnectAttempt = 0;
        authenticated = false;
        if (authToken) {
          send("AuthenticationRequest", {
            pluginName: PLUGIN_NAME,
            pluginDeveloper: PLUGIN_DEVELOPER,
            authenticationToken: authToken,
          });
        } else {
          requestNewToken();
        }
      };

      socket.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch {
          // не JSON — игнорируем
        }
      };

      socket.onclose = async () => {
        if (ws !== socket) return;
        authenticated = false;
        if (await localNetworkBlocked()) {
          report("blocked", "браузер запретил доступ к локальной сети");
        } else {
          report("no-vts", `VTube Studio не отвечает на порту ${port} — запущен ли он и включён ли API?`);
        }
        scheduleReconnect();
      };
    }

    function requestNewToken() {
      report("waiting-approval", 'нажмите "Allow" во всплывающем окне VTube Studio');
      send("AuthenticationTokenRequest", { pluginName: PLUGIN_NAME, pluginDeveloper: PLUGIN_DEVELOPER });
    }

    function handleMessage(msg: { messageType: string; data?: Record<string, unknown> }) {
      const data = msg.data ?? {};

      if (msg.messageType === "AuthenticationTokenResponse") {
        authToken = data.authenticationToken as string;
        // Сохраняем на сервере — чтобы не спрашивать разрешение заново при
        // каждой перезагрузке страницы.
        report("authorizing", "авторизация...", { authToken });
        send("AuthenticationRequest", {
          pluginName: PLUGIN_NAME,
          pluginDeveloper: PLUGIN_DEVELOPER,
          authenticationToken: authToken,
        });
      } else if (msg.messageType === "AuthenticationResponse") {
        authenticated = Boolean(data.authenticated);
        if (authenticated) {
          report("connected", "подключено");
          send("HotkeysInCurrentModelRequest");
          // Хоткеи привязаны к модели — перечитываем их при её смене.
          send("EventSubscriptionRequest", { eventName: "ModelLoadedEvent", subscribe: true, config: {} });
          const queue = pendingHotkeys;
          pendingHotkeys = [];
          queue.forEach(triggerHotkey);
        } else {
          // Токен отозван в настройках VTS — запрашиваем новый.
          authToken = null;
          requestNewToken();
        }
      } else if (msg.messageType === "HotkeysInCurrentModelResponse") {
        const list = ((data.availableHotkeys as VtsHotkey[] | undefined) ?? []).map((h) => ({
          hotkeyID: h.hotkeyID,
          name: h.name,
          type: h.type,
          file: h.file,
        }));
        const model = data.modelLoaded ? String(data.modelName ?? "") : "";
        setState((s) => ({ ...s, model: model || null, hotkeyCount: list.length }));
        report(
          "connected",
          model ? `подключено, модель «${model}», хоткеев: ${list.length}` : "подключено, но модель не загружена",
          { hotkeys: list }
        );
      } else if (msg.messageType === "ModelLoadedEvent") {
        send("HotkeysInCurrentModelRequest");
      } else if (msg.messageType === "APIError") {
        // 50 — пользователь нажал "Deny", 8 — токен недействителен.
        if (data.errorID === 50) {
          authToken = null;
          report("denied", 'доступ отклонён в VTube Studio — нажмите "Переподключить" в дашборде');
        } else if (data.errorID === 8) {
          authToken = null;
          requestNewToken();
        } else {
          setState((s) => ({ ...s, detail: `ошибка VTS: ${String(data.message ?? data.errorID)}` }));
        }
      }
    }

    function scheduleReconnect() {
      if (stopped) return;
      clearTimeout(reconnectTimer);
      reconnectAttempt++;
      reconnectTimer = setTimeout(connect, Math.min(15000, 1500 * reconnectAttempt));
    }

    function reconnect() {
      const old = ws;
      ws = null;
      authenticated = false;
      old?.close();
      reconnectAttempt = 0;
      clearTimeout(reconnectTimer);
      void connect();
    }

    function triggerHotkey(hotkeyId: string) {
      if (!authenticated) {
        pendingHotkeys.push(hotkeyId);
        return;
      }
      send("HotkeyTriggerRequest", { hotkeyID: hotkeyId });
    }

    // null — первый опрос: только запоминаем позицию в очереди, чтобы при
    // открытии страницы не проигрывать старые триггеры из буфера.
    let sinceSeq: number | null = null;
    async function pollEvents() {
      try {
        const res = await fetch(`/api/public/overlay/${token}/events?since=${sinceSeq ?? 0}`, { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as {
            events: { type: string; data?: { hotkeyId?: string } }[];
            latestSeq: number;
          };
          if (sinceSeq !== null) {
            for (const event of body.events) {
              if (event.type === "vtsTrigger" && event.data?.hotkeyId) triggerHotkey(event.data.hotkeyId);
              else if (event.type === "vtsRefreshHotkeys") send("HotkeysInCurrentModelRequest");
              else if (event.type === "vtsReconnect") reconnect();
            }
          }
          sinceSeq = body.latestSeq;
        }
      } catch {
        // сеть моргнула — попробуем на следующем тике
      }
      if (!stopped) pollTimer = setTimeout(pollEvents, EVENTS_POLL_MS);
    }

    const heartbeat = setInterval(() => post({ status: lastReported || "connecting" }), BRIDGE_HEARTBEAT_MS);

    void connect();
    void pollEvents();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      clearTimeout(pollTimer);
      clearInterval(heartbeat);
      const old = ws;
      ws = null;
      old?.close();
    };
  }, [token, active]);

  return state;
}
