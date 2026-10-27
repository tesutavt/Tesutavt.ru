import { NextResponse } from "next/server";

/** Sandboxed widget iframes (`sandbox="allow-scripts"`, no `allow-same-origin`)
 * have an opaque `null` origin, so these public endpoints need an open CORS
 * policy to be readable from inside them. No cookies/session are involved. */
export function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  // Эти эндпоинты постоянно опрашиваются виджетами (тайминг трека, очередь,
  // события) — GET-роуты с динамическим сегментом пути ([token]) Next.js
  // может закэшировать (в отличие от cookies()/headers(), сам по себе
  // параметр пути автоматически не выключает кэш), и тогда виджет годами
  // получал бы один и тот же снимок вместо актуального состояния. Именно
  // так проявлялся баг с "застрявшим" таймингом трека после скипа.
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export function corsPreflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
