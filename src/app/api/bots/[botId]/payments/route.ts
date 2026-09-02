import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 50;
  const currency = searchParams.get("currency");
  const status = searchParams.get("status");

  const where = {
    customer: { botId },
    ...(currency ? { currency: currency.toLowerCase() } : {}),
    ...(status ? { status } : {}),
  };

  const [payments, total, currencyBreakdown] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { firstName: true, lastName: true, username: true, telegramId: true, language: true } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({
      by: ["currency"],
      where: { customer: { botId } },
      _count: { currency: true },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
  ]);

  return NextResponse.json({ payments, total, page, limit, currencyBreakdown });
}
