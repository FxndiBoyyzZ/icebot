import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string; planId: string }> }
) {
  const { planId } = await params;
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { features: true },
  });
  if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; planId: string }> }
) {
  try {
    const { planId } = await params;
    const body = await req.json();

    await prisma.planFeature.deleteMany({ where: { planId } });

    const plan = await prisma.plan.update({
      where: { id: planId },
      data: {
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
    return NextResponse.json(plan);
  } catch (err: unknown) {
    console.error("PUT plan error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao salvar plano" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string; planId: string }> }
) {
  const { planId } = await params;
  await prisma.plan.delete({ where: { id: planId } });
  return NextResponse.json({ ok: true });
}
