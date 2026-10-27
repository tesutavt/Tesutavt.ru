/**
 * Коды состояния моста VTube Studio. Мост (страница /vts/[token]) шлёт их
 * на сервер, дашборд читает — поэтому список общий.
 */
export type VtsBridgeCode =
  | "waiting-click" // страница открыта в браузере, ждёт нажатия «Подключить»
  | "connecting" // ищем VTube Studio на 127.0.0.1:порт
  | "no-vts" // VTube Studio не отвечает
  | "blocked" // браузер запретил доступ к локальной сети
  | "waiting-approval" // ждём «Allow» в VTube Studio
  | "authorizing"
  | "connected"
  | "denied"; // в VTube Studio нажали «Deny»

export const VTS_STATUS_TEXT: Record<VtsBridgeCode, string> = {
  "waiting-click": "Страница подключения открыта — нажмите на ней «Подключить»",
  connecting: "Ищем VTube Studio на этом компьютере…",
  "no-vts": "VTube Studio не отвечает — он запущен и включён API?",
  blocked: "Браузер запретил доступ к локальной сети",
  "waiting-approval": "Нажмите «Allow» во всплывающем окне VTube Studio",
  authorizing: "Авторизация…",
  connected: "Подключено",
  denied: "Доступ отклонён в VTube Studio",
};

/** Мост шлёт heartbeat раз в 10 с — если дольше 25 с тишина, считаем его закрытым. */
export const BRIDGE_ONLINE_MS = 25000;
export const BRIDGE_HEARTBEAT_MS = 10000;

/** Через какой шаг мастера подключения проходит этот статус. */
export function wizardStepFor(code: string | null, online: boolean): 2 | 3 | 4 {
  if (!online) return 2;
  if (code === "connected") return 4;
  if (code === "waiting-approval" || code === "authorizing" || code === "denied") return 3;
  return 2;
}
