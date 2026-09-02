import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const plans = await prisma.plan.findMany({
    where: { botId },
    include: {
      features: true,
      _count: { select: { subscriptions: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(plans);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const body = await req.json();
  const plan = await prisma.plan.create({
    data: {
      botId,
      name: body.name,
      description: body.description ?? null,
      price: body.price ?? 0,
      priceBRL: body.priceBRL ?? null,
      currency: "USD",
      interval: body.interval ?? "monthly",
      trialDays: body.trialDays ?? 0,
      active: body.active ?? true,
      features: {
        create: ((body.features ?? []) as { text: string }[])
          .filter((f) => f.text?.trim())
          .map((f) => ({ text: f.text.trim() })),
      },
    },
    include: { features: true },
  });
  return NextResponse.json(plan, { status: 201 });
}
