import { NextResponse } from "next/server";
import { BANNED_WORD_ERROR, containsBannedWordDeep } from "@/lib/moderation/banned-words";

/** Ответ API при срабатывании фильтра — без указания самого слова. */
export function bannedWordResponse() {
  return NextResponse.json({ error: BANNED_WORD_ERROR, code: "banned_word" }, { status: 422 });
}

/** null — всё чисто, иначе готовый ответ 422 для роута. */
export function checkBannedWords(value: unknown, skipKeys?: ReadonlySet<string>) {
  return containsBannedWordDeep(value, skipKeys) ? bannedWordResponse() : null;
}
