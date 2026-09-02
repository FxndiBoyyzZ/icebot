import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LANG_PRICING } from "@/lib/pricing";

const CURRENCY_TO_LANGS: Record<string, string[]> = {};
for (const [lang, [currency]] of Object.entries(LANG_PRICING)) {
  const cur = currency.toUpperCase();
  (CURRENCY_TO_LANGS[cur] ??= []).push(lang);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 50;
  const source = searchParams.get("source");
  const lang = searchParams.get("lang");
  const currency = searchParams.get("currency");

  const langFilter = lang
    ? { language: lang }
    : currency
    ? { language: { in: CURRENCY_TO_LANGS[currency.toUpperCase()] ?? [] } }
    : {};

  const where = {
    botId,
    ...(source ? { source } : {}),
    ...langFilter,
  };

  const [customers, total, sources, langs] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        subscriptions: {
          where: { status: { in: ["active", "trialing"] } },
          take: 1,
          include: { plan: { select: { name: true } } },
        },
      },
    }),
    prisma.customer.count({ where }),
    prisma.customer.groupBy({
      by: ["source"],
      where: { botId, source: { not: null } },
      _count: { source: true },
      orderBy: { _count: { source: "desc" } },
    }),
    prisma.customer.groupBy({
      by: ["language"],
      where: { botId, language: { not: null } },
      _count: { language: true },
      orderBy: { _count: { language: "desc" } },
    }),
  ]);

  // Aggregate language counts into currency counts
  const currencyMap: Record<string, number> = {};
  for (const l of langs) {
    if (!l.language) continue;
    const cur = (LANG_PRICING[l.language]?.[0] ?? "usd").toUpperCase();
    currencyMap[cur] = (currencyMap[cur] ?? 0) + l._count.language;
  }
  const currencies = Object.entries(currencyMap)
    .map(([currency, count]) => ({ currency, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ customers, total, page, limit, sources, langs, currencies });
}
