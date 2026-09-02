import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const bots = await prisma.bot.findMany({
      include: { _count: { select: { plans: true, customers: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(bots);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao buscar bots" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, username, token, description } = body;

    if (!name || !token) {
      return NextResponse.json({ error: "Nome e token são obrigatórios" }, { status: 400 });
    }

    // Ensure default org exists
    await prisma.organization.upsert({
      where: { id: "default-org" },
      update: {},
      create: { id: "default-org", name: "Default", slug: "default", clerkOrgId: "default-org" },
    });

    const bot = await prisma.bot.create({
      data: {
        name,
        token,
        description: description || null,
        username: username || null,
        orgId: "default-org",
      },
    });

    return NextResponse.json(bot, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao criar bot" }, { status: 500 });
  }
}
