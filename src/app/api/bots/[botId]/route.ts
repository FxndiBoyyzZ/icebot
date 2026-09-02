import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });
  return NextResponse.json(bot);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const body = await req.json();
  const bot = await prisma.bot.update({
    where: { id: botId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.active !== undefined && { active: body.active }),
    },
  });
  return NextResponse.json(bot);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  await prisma.bot.delete({ where: { id: botId } });
  return NextResponse.json({ ok: true });
}
