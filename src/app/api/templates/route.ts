import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ORG_ID = "default-org";

export async function GET() {
  const templates = await prisma.botTemplate.findMany({
    where: { orgId: ORG_ID },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  try {
    const { sourceBot, name, steps } = await req.json();
    if (!sourceBot || !name || !steps) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }
    const template = await prisma.botTemplate.create({
      data: { orgId: ORG_ID, sourceBot, name, steps },
    });
    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao salvar template";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.botTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao deletar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
