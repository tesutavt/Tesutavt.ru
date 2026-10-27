// Встроенный фильтр слов, за которые Twitch банит канал (оскорбления по
// признаку расы/национальности/ориентации/инвалидности, призывы к
// самоповреждению). Обычный мат Twitch не запрещает — его тут нет.
//
// ТОЛЬКО ДЛЯ СЕРВЕРА. Пользователи сайта этот список не видят и не
// настраивают: модуль нельзя импортировать из "use client"-компонентов,
// иначе список уедет в браузерный бандл. Клиент узнаёт о срабатывании
// только из ответа API (см. bannedWordResponse) — без указания самого слова.

/** Корни: совпадение в начале слова, дальше любые окончания. */
const LATIN_STEMS = [
  "nigger", "nigga", "niggr", "nigglet", "sandnigger",
  "faggot", "fagot", "faggit",
  "tranny", "trannie", "shemale",
  "retard",
  "wetback", "beaner", "raghead", "towelhead",
  "pidor", "pidar", "pidr", "pederast",
  "hohol", "hohl", "churka", "churok",
  "chernozh", "chernomaz",
  "killyourself", "killurself", "killyoself",
];

/** Целые слова (без окончаний) — короткие, иначе ловили бы нормальные слова. */
const LATIN_WORDS = ["fag", "fags", "kike", "kikes", "chink", "chinks", "spic", "spics", "gook", "gooks", "coon", "coons", "dyke", "dykes", "kys", "zhid", "zhidy"];

const CYRILLIC_STEMS = [
  "ниггер", "нигга", "негритос", "негрила",
  "пидор", "пидар", "пидр", "педераст", "педик", "гомик", "гомосек",
  "хохол", "хохл", "хохлят",
  "чурк", "чурок", "чучмек",
  "черномаз", "чернож",
  "жидов", "жидяр", "жидён", "жиденок",
  "узкоглаз",
  "транни", "ретард",
  "самоубейся", "выпились", "вскройся",
];

// "нигер" (ед. ч.) не блокируем — совпадает с названием страны.
const CYRILLIC_WORDS = ["нигеры", "нигеров", "нигерам", "нигерами", "нигерах", "нигерок", "жид", "жида", "жиду", "жиды", "жидом", "жидам", "жидами", "жидах", "хач", "хача", "хачу", "хачи", "хачей", "хачик", "хачики", "хачам"];

/** Фразы: слова подряд через любые пробелы/знаки. */
const LATIN_PHRASES = [["kill", "your", "self"], ["kill", "urself"], ["go", "kill", "yourself"]];
const CYRILLIC_PHRASES = [["убей", "себя"], ["убейся", "об", "стену"], ["иди", "повесься"], ["иди", "вскройся"]];

/** Нормальные слова, которые начинаются с запрещённого корня. */
const ALLOWED_PREFIXES = [
  "нигери", "нигерск", "хохлом", "хохлат", "педикюр", "педикул",
  "retardant", "retardat", "nigeria",
];

// Похожие буквы/цифры, которыми обходят фильтры ("п1д0р", "pидoр").
const TO_LATIN: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i",
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i", "|": "i",
};
const TO_CYRILLIC: Record<string, string> = {
  a: "а", b: "в", c: "с", e: "е", k: "к", m: "м", o: "о", p: "р", x: "х", y: "у", u: "и", i: "и", n: "п", r: "г",
  h: "н", t: "т", ё: "е", "0": "о", "3": "з", "4": "ч", "6": "б", "@": "а",
};

// Символы, которые вставляют внутрь слова: "п.и.д.о.р", "n*gger", невидимые пробелы.
const IN_WORD_SEPARATORS = "[._\\-*~'`\"’+]*";
const LETTER = "[\\p{L}]";

function letterPattern(word: string): string {
  // Каждая буква может повторяться ("пиииидор"), но двойные в корне
  // остаются обязательными: "nigger" → n+i+g+g+e+r+ не совпадёт с "Niger".
  // Те же преобразования, что и для текста (й → и после снятия диакритики).
  const normalized = word.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ё/g, "е");
  return [...normalized].map((ch) => `${ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+`).join(IN_WORD_SEPARATORS);
}

function buildRegex(stems: string[], words: string[], phrases: string[][]): RegExp {
  const parts = [
    ...stems.map((s) => `(?<!${LETTER})${letterPattern(s)}`),
    ...words.map((w) => `(?<!${LETTER})${letterPattern(w)}(?!${LETTER})`),
    ...phrases.map((p) => `(?<!${LETTER})${p.map(letterPattern).join("[^\\p{L}]*")}`),
  ];
  return new RegExp(parts.join("|"), "giu");
}

const LATIN_RE = buildRegex(LATIN_STEMS, LATIN_WORDS, LATIN_PHRASES);
const CYRILLIC_RE = buildRegex(CYRILLIC_STEMS, CYRILLIC_WORDS, CYRILLIC_PHRASES);

function baseNormalize(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // диакритика
      .replace(/[​-‏⁠﻿­]/g, "") // невидимые символы
      .toLowerCase()
      .replace(/ё/g, "е")
      // "п и д о р" / "n i g g e r" — склеиваем цепочки одиночных букв
      .replace(/(?<![\p{L}\d])(?:[\p{L}\d@$!|][\s]+){2,}[\p{L}\d@$!|](?![\p{L}\d])/gu, (m) => m.replace(/\s+/g, ""))
  );
}

function mapChars(text: string, table: Record<string, string>): string {
  let out = "";
  for (const ch of text) out += table[ch] ?? ch;
  return out;
}

function hasMatch(re: RegExp, text: string): boolean {
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    const word = text.slice(start).match(/^[\p{L}\d._\-*~'`"’+@$!|]+/u)?.[0]?.replace(/[^\p{L}]/gu, "") ?? "";
    if (!ALLOWED_PREFIXES.some((p) => word.startsWith(p))) return true;
  }
  return false;
}

/** true — в тексте есть запрещённое на Twitch слово. */
export function containsBannedWord(text: string | null | undefined): boolean {
  if (!text) return false;
  const base = baseNormalize(String(text));
  return hasMatch(LATIN_RE, mapChars(base, TO_LATIN)) || hasMatch(CYRILLIC_RE, mapChars(base, TO_CYRILLIC));
}

/** Рекурсивно проверяет все строки в значении (объекты, массивы, JSON полей). */
export function containsBannedWordDeep(value: unknown, skipKeys: ReadonlySet<string> = new Set()): boolean {
  if (typeof value === "string") return containsBannedWord(value);
  if (Array.isArray(value)) return value.some((v) => containsBannedWordDeep(v, skipKeys));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => !skipKeys.has(k) && containsBannedWordDeep(v, skipKeys));
  }
  return false;
}

export const BANNED_WORD_ERROR = "Текст содержит слово, запрещённое правилами Twitch. Измените формулировку.";
