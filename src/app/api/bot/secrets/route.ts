import { NextRequest, NextResponse } from "next/server";
import { ownerSession, OWNER_ONLY_ERROR } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { SECRET_NAME_RE, maskSecret } from "@/lib/bot/secrets";

/** Значения секретов наружу не отдаём — только маску. */
export async function GET() {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secrets = await prisma.botSecret.findMany({ where: { userId: session.user.id }, orderBy: { name: "asc" } });
  return NextResponse.json(secrets.map((s) => ({ id: s.id, name: s.name, masked: maskSecret(s.value) })));
}

/** Создаёт секрет или заменяет значение существующего с тем же именем. */
export async function POST(req: NextRequest) {
  const { session, forbidden } = await ownerSession();
  if (forbidden) return NextResponse.json({ error: OWNER_ONLY_ERROR }, { status: 403 });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const value = String(body.value ?? "");
  if (!SECRET_NAME_RE.test(name)) {
    return NextResponse.json({ error: "Имя — латиница, цифры и _, начинается с буквы (например WEATHER_KEY)" }, { status: 400 });
  }
  if (!value || value.length > 4000) {
    return NextResponse.json({ error: "Значение пустое или слишком длинное" }, { status: 400 });
  }

  const secret = await prisma.botSecret.upsert({
    where: { userId_name: { userId: session.user.id, name } },
    create: { userId: session.user.id, name, value },
    update: { value },
  });
  return NextResponse.json({ id: secret.id, name: secret.name, masked: maskSecret(secret.value) });
}
