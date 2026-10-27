// Общие типы для Blueprint-редактора команд бота: и клиент (редактор), и
// сервер (исполнитель в lib/blueprint/execute.ts) используют их напрямую.

export type BpNodeType =
  | "trigger"
  | "rewardTrigger"
  | "sendMessage"
  | "httpRequest"
  | "getJsonPath"
  | "template"
  | "customJs"
  | "vtsHotkey"
  | "viewerGet"
  | "viewerSet"
  | "redemptionStatus";

/** Где живёт граф: команда чата или награда за баллы канала. */
export type BpContextKind = "command" | "reward";

export interface HttpKeyValue {
  key: string;
  value: string;
}

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpBodyType = "none" | "json" | "form" | "text";

export interface BpNode {
  id: string;
  type: BpNodeType;
  x: number;
  y: number;
  /** Произвольные данные узла (текст, url, код и т.д.) - форма зависит от type, см. NODE_DEFS. */
  data: Record<string, unknown>;
}

export interface BpEdge {
  id: string;
  fromNode: string;
  fromPin: string;
  toNode: string;
  toPin: string;
}

export interface BpGraph {
  nodes: BpNode[];
  edges: BpEdge[];
}

export type PinKind = "exec" | "data";

export interface PinDef {
  name: string;
  kind: PinKind;
  label?: string;
}

export interface NodeDef {
  type: BpNodeType;
  label: string;
  description: string;
  color: string;
  /** Можно положить на холст руками из палитры (trigger - нет, он один и создаётся автоматически). */
  addable: boolean;
  inputs: PinDef[];
  outputs: PinDef[];
  /** Поддерживает пользовательские доп. пины данных на вход (data.extraInputs: string[]). */
  supportsExtraInputs?: boolean;
  /** Поддерживает пользовательские пины данных на выход (data.extraOutputs: string[]) - только customJs. */
  supportsExtraOutputs?: boolean;
  /** В каких графах блок доступен; по умолчанию — везде. */
  contexts?: BpContextKind[];
}

export const TRIGGER_VARS = ["user", "message", "args", "channel"] as const;
export const REWARD_TRIGGER_VARS = ["user", "input", "reward", "cost", "channel"] as const;

export const NODE_DEFS: Record<BpNodeType, NodeDef> = {
  trigger: {
    type: "trigger",
    label: "Команда вызвана",
    description: "Точка входа графа - срабатывает при вызове команды в чате",
    color: "#7c3aed",
    addable: false,
    contexts: ["command"],
    inputs: [],
    outputs: [
      { name: "exec", kind: "exec" },
      { name: "user", kind: "data", label: "Ник" },
      { name: "message", kind: "data", label: "Всё сообщение" },
      { name: "args", kind: "data", label: "Аргументы (после команды)" },
      { name: "channel", kind: "data", label: "Канал" },
    ],
  },
  rewardTrigger: {
    type: "rewardTrigger",
    label: "Награда получена",
    description: "Точка входа графа - срабатывает, когда зритель тратит баллы на эту награду",
    color: "#7c3aed",
    addable: false,
    contexts: ["reward"],
    inputs: [],
    outputs: [
      { name: "exec", kind: "exec" },
      { name: "user", kind: "data", label: "Ник" },
      { name: "input", kind: "data", label: "Текст зрителя" },
      { name: "reward", kind: "data", label: "Название награды" },
      { name: "cost", kind: "data", label: "Стоимость" },
      { name: "channel", kind: "data", label: "Канал" },
    ],
  },
  sendMessage: {
    type: "sendMessage",
    label: "Отправить в чат",
    description: "Отправляет текст в чат. В тексте доступны переменные триггера ({user} и т.д.), {viewer.city} и свои параметры",
    color: "#2563eb",
    addable: true,
    inputs: [{ name: "exec", kind: "exec" }],
    outputs: [{ name: "exec", kind: "exec" }],
    supportsExtraInputs: true,
  },
  httpRequest: {
    type: "httpRequest",
    label: "HTTP-запрос",
    description:
      "Запрос к внешнему API: метод, заголовки, тело. Ключи API храните в секретах и пишите как {secret:ИМЯ}",
    color: "#059669",
    addable: true,
    inputs: [{ name: "exec", kind: "exec" }],
    outputs: [
      { name: "exec", kind: "exec", label: "Успех" },
      { name: "error", kind: "exec", label: "Ошибка" },
      { name: "json", kind: "data" },
      { name: "text", kind: "data", label: "text (тело как текст)" },
      { name: "status", kind: "data" },
    ],
    supportsExtraInputs: true,
  },
  getJsonPath: {
    type: "getJsonPath",
    label: "Взять поле JSON",
    description: 'Достаёт значение по пути вида "current.temp_c" из JSON-объекта',
    color: "#059669",
    addable: true,
    inputs: [{ name: "json", kind: "data" }],
    outputs: [{ name: "value", kind: "data" }],
  },
  template: {
    type: "template",
    label: "Собрать текст",
    description: "Склеивает текст с параметрами через {имя} - для многошаговых цепочек до отправки",
    color: "#d97706",
    addable: true,
    inputs: [],
    outputs: [{ name: "text", kind: "data" }],
    supportsExtraInputs: true,
  },
  vtsHotkey: {
    type: "vtsHotkey",
    label: "Хоткей VTube Studio",
    description: "Запускает сохранённый триггер VTube Studio (настраивается во вкладке VTube Studio)",
    color: "#0ea5e9",
    addable: true,
    inputs: [{ name: "exec", kind: "exec" }],
    outputs: [{ name: "exec", kind: "exec" }],
    supportsExtraInputs: true,
  },
  viewerGet: {
    type: "viewerGet",
    label: "Данные зрителя",
    description:
      "Читает поле мини-БД зрителя (то, что он сохранил через !set). Без провода в «ник» - данные того, кто вызвал",
    color: "#0d9488",
    addable: true,
    inputs: [{ name: "login", kind: "data", label: "ник (необязательно)" }],
    outputs: [
      { name: "value", kind: "data", label: "Значение" },
      { name: "exists", kind: "data", label: "Заполнено (true/false)" },
    ],
  },
  viewerSet: {
    type: "viewerSet",
    label: "Записать данные зрителя",
    description: "Сохраняет значение в поле мини-БД того, кто вызвал команду/награду (как !set)",
    color: "#0d9488",
    addable: true,
    inputs: [{ name: "exec", kind: "exec" }],
    outputs: [
      { name: "exec", kind: "exec", label: "Сохранено" },
      { name: "error", kind: "exec", label: "Ошибка" },
      { name: "value", kind: "data", label: "Сохранённое значение" },
      { name: "errorText", kind: "data", label: "Текст ошибки" },
    ],
    supportsExtraInputs: true,
  },
  redemptionStatus: {
    type: "redemptionStatus",
    label: "Завершить награду",
    description: "Помечает получение награды выполненным или отменяет его с возвратом баллов зрителю",
    color: "#7c3aed",
    addable: true,
    contexts: ["reward"],
    inputs: [{ name: "exec", kind: "exec" }],
    outputs: [{ name: "exec", kind: "exec" }],
  },
  customJs: {
    type: "customJs",
    label: "Свой JS-блок",
    description: "Произвольный JS: function run(inputs) { return { output: ... } }",
    color: "#db2777",
    addable: true,
    inputs: [{ name: "exec", kind: "exec" }],
    outputs: [{ name: "exec", kind: "exec" }],
    supportsExtraInputs: true,
    supportsExtraOutputs: true,
  },
};

export function nodeAvailableIn(def: NodeDef, kind: BpContextKind) {
  return !def.contexts || def.contexts.includes(kind);
}

/** Пустой граф с точкой входа нужного вида. */
export function emptyGraph(kind: BpContextKind): BpGraph {
  const trigger = createNode(kind === "reward" ? "rewardTrigger" : "trigger", 60, 200);
  trigger.id = "trigger";
  return { nodes: [trigger], edges: [] };
}

export function createNode(type: BpNodeType, x: number, y: number): BpNode {
  const def = NODE_DEFS[type];
  const data: Record<string, unknown> = {};
  if (type === "sendMessage") data.text = "Привет, {user}!";
  if (type === "httpRequest") {
    data.url = "https://";
    data.method = "GET";
    data.headers = [];
    data.bodyType = "none";
    data.body = "";
    data.formFields = [];
    data.timeoutSec = 5;
  }
  if (type === "viewerGet") data.key = "city";
  if (type === "viewerSet") {
    data.key = "city";
    data.value = "{args}";
  }
  if (type === "redemptionStatus") data.status = "FULFILLED";
  if (type === "getJsonPath") data.path = "";
  if (type === "template") data.text = "";
  if (type === "customJs") data.code = "function run(inputs) {\n  return { output: inputs };\n}";
  if (type === "vtsHotkey") data.name = "";
  if (def.supportsExtraInputs) data.extraInputs = [];
  if (def.supportsExtraOutputs) data.extraOutputs = ["output"];
  return { id: "n" + Math.random().toString(36).slice(2, 10), type, x, y, data };
}
