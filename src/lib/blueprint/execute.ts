import vm from "node:vm";
import type { BpGraph, BpNode, HttpBodyType, HttpKeyValue } from "@/lib/blueprint/types";
import { HTTP_METHODS } from "@/lib/blueprint/types";
import { fireVtsTrigger } from "@/lib/bot/vts-fire";
import { getUserSecrets } from "@/lib/bot/secrets";
import { getViewerValues, setViewerValue, type ViewerRef } from "@/lib/viewer-data";
import { updateRedemptionStatus } from "@/lib/rewards/twitch-rewards";

export interface BlueprintContext {
  /** Переменные точки входа: user/message/args/channel у команды, user/input/reward/cost/channel у награды. */
  vars: Record<string, string>;
  /** Кто вызвал команду / получил награду — для {viewer.*} и блоков данных зрителя. */
  viewer: ViewerRef | null;
  /** Есть только у графов наград — для блока "Завершить награду". */
  redemption?: { id: string; twitchRewardId: string; broadcasterTwitchId: string };
}

export interface BlueprintRunResult {
  sentMessages: string[];
  error?: string;
}

const MAX_STEPS = 200;
const MAX_MS = 10000;
const MAX_HTTP_TIMEOUT_SEC = 10;
const MAX_RESPONSE_TEXT = 20000;
const MAX_REDIRECTS = 3;

/** {user}, {args}, {имя_пина}, {viewer.city}, {secret:API_KEY} */
const PLACEHOLDER_RE = /\{([a-zA-Z0-9_]+(?:[.:][a-zA-Z0-9_]+)?)\}/g;

/**
 * Простая однопоточная (без ветвлений/циклов - см. ограничения в описании
 * фичи) машина исполнения: идём по exec-рёбрам от trigger, у каждого узла
 * перед запуском "подтягиваем" (pull) значения его data-входов, рекурсивно
 * вычисляя узлы-источники через resolveData. Каждый узел считается не
 * больше одного раза за запуск (кэш) - иначе httpRequest мог бы уйти в
 * сеть повторно только из-за того, что его результат кто-то ещё читает.
 */
export async function runBlueprint(graph: BpGraph, ctx: BlueprintContext, userId: string): Promise<BlueprintRunResult> {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const dataCache = new Map<string, unknown>();
  const ranNodes = new Set<string>();
  const sentMessages: string[] = [];
  const startedAt = Date.now();
  let steps = 0;

  // Грузятся лениво и один раз за запуск.
  let secrets: Record<string, string> | null = null;
  let callerValues: Record<string, string> | null = null;

  function edgeInto(nodeId: string, pin: string) {
    return graph.edges.find((e) => e.toNode === nodeId && e.toPin === pin);
  }

  function edgesOut(nodeId: string, pin: string) {
    return graph.edges.filter((e) => e.fromNode === nodeId && e.fromPin === pin);
  }

  function tick() {
    steps++;
    if (steps > MAX_STEPS) throw new Error("Слишком много шагов в графе (возможен цикл)");
    if (Date.now() - startedAt > MAX_MS) throw new Error("Граф выполняется слишком долго");
  }

  async function resolveData(nodeId: string, pin: string): Promise<unknown> {
    if (nodeId === "trigger") return ctx.vars[pin] ?? "";
    const cacheKey = `${nodeId}.${pin}`;
    if (dataCache.has(cacheKey)) return dataCache.get(cacheKey);

    const node = nodesById.get(nodeId);
    if (!node) return "";

    await computeNode(node);
    return dataCache.get(cacheKey) ?? "";
  }

  async function resolveInputPin(nodeId: string, pin: string): Promise<unknown> {
    const edge = edgeInto(nodeId, pin);
    if (!edge) return undefined;
    return resolveData(edge.fromNode, edge.fromPin);
  }

  async function callerValue(key: string): Promise<string> {
    if (!ctx.viewer) return "";
    callerValues ??= await getViewerValues(userId, { twitchId: ctx.viewer.twitchId });
    return callerValues[key.toLowerCase()] ?? "";
  }

  /**
   * Подставляет плейсхолдеры. Порядок: подключённый пин с таким именем →
   * переменная триггера. {secret:*} раскрываются только там, где это явно
   * разрешено (HTTP-запрос) — чтобы ключ API нельзя было вывести в чат.
   */
  async function interpolate(
    nodeId: string,
    text: string,
    opts: { secrets?: boolean; escape?: (v: string) => string } = {}
  ): Promise<string> {
    let result = "";
    let last = 0;
    for (const m of text.matchAll(PLACEHOLDER_RE)) {
      const name = m[1];
      let value: string;
      if (name.startsWith("secret:")) {
        if (opts.secrets) {
          secrets ??= await getUserSecrets(userId);
          value = secrets[name.slice("secret:".length)] ?? "";
        } else {
          value = "";
        }
      } else if (name.startsWith("viewer.")) {
        value = await callerValue(name.slice("viewer.".length));
      } else {
        const pinValue = await resolveInputPin(nodeId, name);
        const raw = pinValue !== undefined ? pinValue : ctx.vars[name];
        value = raw === undefined || raw === null ? "" : typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      }
      // Значения секретов не экранируем — это готовые токены/ключи.
      const escaped = opts.escape && !name.startsWith("secret:") ? opts.escape(value) : value;
      result += text.slice(last, m.index) + escaped;
      last = (m.index ?? 0) + m[0].length;
    }
    return result + text.slice(last);
  }

  async function computeNode(node: BpNode): Promise<void> {
    if (ranNodes.has(node.id)) return;
    ranNodes.add(node.id);
    tick();

    if (node.type === "getJsonPath") {
      const json = await resolveInputPin(node.id, "json");
      const path = String(node.data.path ?? "");
      dataCache.set(`${node.id}.value`, getPath(json, path));
    } else if (node.type === "template") {
      dataCache.set(`${node.id}.text`, await interpolate(node.id, String(node.data.text ?? "")));
    } else if (node.type === "viewerGet") {
      const key = String(node.data.key ?? "").toLowerCase();
      const login = await resolveInputPin(node.id, "login");
      let value = "";
      if (login !== undefined && String(login).trim()) {
        const values = await getViewerValues(userId, { login: String(login).trim() });
        value = values[key] ?? "";
      } else {
        value = await callerValue(key);
      }
      dataCache.set(`${node.id}.value`, value);
      dataCache.set(`${node.id}.exists`, Boolean(value));
    } else if (node.type === "customJs") {
      const inputNames = Array.isArray(node.data.extraInputs) ? (node.data.extraInputs as string[]) : [];
      const inputs: Record<string, unknown> = {};
      for (const name of inputNames) inputs[name] = (await resolveInputPin(node.id, name)) ?? "";
      const outputs = await runCustomJs(String(node.data.code ?? ""), inputs);
      const outputNames = Array.isArray(node.data.extraOutputs) ? (node.data.extraOutputs as string[]) : [];
      for (const name of outputNames) dataCache.set(`${node.id}.${name}`, outputs?.[name]);
    }
    // Узлы с эффектами (sendMessage/httpRequest/viewerSet/...) запускаются
    // только через runExec (ниже), не через pull.
  }

  async function runHttpRequest(node: BpNode): Promise<"exec" | "error"> {
    const setResult = (json: unknown, text: string, status: number) => {
      dataCache.set(`${node.id}.json`, json);
      dataCache.set(`${node.id}.text`, text);
      dataCache.set(`${node.id}.status`, status);
    };

    try {
      const url = await interpolate(node.id, String(node.data.url ?? ""), { secrets: true });
      const target = new URL(url);
      if (!isPublicHttpUrl(target)) throw new Error("Запросы к локальным/внутренним адресам запрещены");

      const method = HTTP_METHODS.includes(String(node.data.method) as (typeof HTTP_METHODS)[number])
        ? String(node.data.method)
        : "GET";
      const headers = new Headers();
      for (const h of asKeyValues(node.data.headers)) {
        const key = (await interpolate(node.id, h.key, { secrets: true })).trim();
        if (key) headers.set(key, await interpolate(node.id, h.value, { secrets: true }));
      }

      let body: string | undefined;
      const bodyType = String(node.data.bodyType ?? "none") as HttpBodyType;
      if (method !== "GET" && bodyType !== "none") {
        if (bodyType === "json") {
          // Значения вставляются внутрь JSON-строк — экранируем кавычки и переносы.
          body = await interpolate(node.id, String(node.data.body ?? ""), {
            secrets: true,
            escape: (v) => JSON.stringify(v).slice(1, -1),
          });
          if (!headers.has("content-type")) headers.set("Content-Type", "application/json");
        } else if (bodyType === "form") {
          const form = new URLSearchParams();
          for (const f of asKeyValues(node.data.formFields)) {
            const key = await interpolate(node.id, f.key, { secrets: true });
            if (key) form.append(key, await interpolate(node.id, f.value, { secrets: true }));
          }
          body = form.toString();
          if (!headers.has("content-type")) headers.set("Content-Type", "application/x-www-form-urlencoded");
        } else {
          body = await interpolate(node.id, String(node.data.body ?? ""), { secrets: true });
          if (!headers.has("content-type")) headers.set("Content-Type", "text/plain; charset=utf-8");
        }
      }

      const timeoutSec = Math.min(MAX_HTTP_TIMEOUT_SEC, Math.max(1, Number(node.data.timeoutSec) || 5));
      const signal = AbortSignal.timeout(timeoutSec * 1000);
      // Редиректы проходим вручную, проверяя каждый адрес — иначе внешний
      // сервер мог бы перенаправить запрос во внутреннюю сеть.
      let current = target;
      let res = await fetch(current, { method, headers, body, redirect: "manual", signal });
      for (let hop = 0; hop < MAX_REDIRECTS && res.status >= 300 && res.status < 400; hop++) {
        const location = res.headers.get("location");
        if (!location) break;
        current = new URL(location, current);
        if (!isPublicHttpUrl(current)) throw new Error("Редирект на внутренний адрес запрещён");
        const keepBody = res.status === 307 || res.status === 308;
        // Ключ в заголовке не отдаём другому домену.
        if (current.origin !== target.origin) {
          headers.delete("authorization");
          headers.delete("cookie");
        }
        res = await fetch(current, {
          method: keepBody ? method : "GET",
          headers,
          body: keepBody ? body : undefined,
          redirect: "manual",
          signal,
        });
      }
      const text = (await res.text()).slice(0, MAX_RESPONSE_TEXT);
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      setResult(json, text, res.status);
      return res.ok ? "exec" : "error";
    } catch (err) {
      setResult(null, err instanceof Error ? err.message : String(err), 0);
      return "error";
    }
  }

  async function runExec(nodeId: string): Promise<void> {
    const node = nodesById.get(nodeId);
    if (!node) return;
    tick();

    let nextPin = "exec";

    if (node.type === "trigger" || node.type === "rewardTrigger") {
      // просто идём дальше
    } else if (node.type === "sendMessage") {
      const text = await interpolate(node.id, String(node.data.text ?? ""));
      if (text.trim()) sentMessages.push(text.trim().slice(0, 500));
    } else if (node.type === "httpRequest") {
      nextPin = await runHttpRequest(node);
    } else if (node.type === "customJs") {
      await computeNode(node);
    } else if (node.type === "vtsHotkey") {
      const name = await interpolate(node.id, String(node.data.name ?? ""));
      if (name.trim()) await fireVtsTrigger(userId, { name: name.trim() });
    } else if (node.type === "viewerSet") {
      const value = await interpolate(node.id, String(node.data.value ?? ""));
      const result = ctx.viewer
        ? await setViewerValue(userId, ctx.viewer, String(node.data.key ?? ""), value)
        : ({ ok: false, error: "Неизвестно, кто вызвал" } as const);
      dataCache.set(`${node.id}.value`, result.ok ? result.value : "");
      dataCache.set(`${node.id}.errorText`, result.ok ? "" : result.error);
      if (result.ok) callerValues = null; // следующий {viewer.*} увидит новое значение
      nextPin = result.ok ? "exec" : "error";
    } else if (node.type === "redemptionStatus") {
      if (ctx.redemption) {
        const status = node.data.status === "CANCELED" ? "CANCELED" : "FULFILLED";
        await updateRedemptionStatus(userId, ctx.redemption, status);
      }
    }

    for (const edge of edgesOut(nodeId, nextPin)) {
      await runExec(edge.toNode);
    }
  }

  try {
    await runExec("trigger");
  } catch (err) {
    return { sentMessages, error: err instanceof Error ? err.message : String(err) };
  }

  return { sentMessages };
}

function asKeyValues(value: unknown): HttpKeyValue[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
    .map((v) => ({ key: String(v.key ?? ""), value: String(v.value ?? "") }));
}

/**
 * Не даём блюпринтам ходить во внутреннюю сеть сервера (БД в docker,
 * метаданные облака и т.п.). Проверяется буквальный адрес; хосты без
 * точки (имена docker-сервисов вроде "postgres") тоже запрещены.
 */
function isPublicHttpUrl(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(".") && !host.includes(":")) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)) return false;
    if ((a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return false;
  }
  if (host.includes(":")) {
    if (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
      return false;
    }
    if (host.startsWith("::ffff:")) return false;
  }
  return true;
}

function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    const index = Number(key);
    if (Array.isArray(acc) && Number.isInteger(index)) return acc[index];
    if (typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/**
 * Изолированный контекст vm (не тот же scope, что у остального сервера) -
 * без require/process/fetch. Сеть - только через отдельный узел
 * httpRequest, customJs - чистые вычисления. Таймаут защищает от
 * бесконечных циклов внутри самого кода узла.
 */
async function runCustomJs(code: string, inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const context = vm.createContext({});
    const script = new vm.Script(`(function(){ ${code}\n; return run; })()`);
    const runFn = script.runInContext(context, { timeout: 1000 });
    if (typeof runFn !== "function") return {};
    const result = runFn(inputs);
    return typeof result === "object" && result !== null ? (result as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
