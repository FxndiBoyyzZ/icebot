import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const messages = await prisma.message.findMany({
      where: { botId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(messages);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const body = await req.json();
    const message = await prisma.message.create({
      data: {
        botId,
        name: body.name,
        trigger: body.trigger ?? null,
        content: body.content,
        parseMode: body.parseMode ?? "MarkdownV2",
        buttons: body.buttons ?? null,
        translations: body.translations ? JSON.stringify(body.translations) : null,
        mediaIds: body.mediaIds ? JSON.stringify(body.mediaIds) : null,
        secondaryContent: body.secondaryContent ?? null,
        secondaryEnabled: body.secondaryEnabled ?? false,
        ctaEnabled: body.ctaEnabled ?? false,
        dynamicMedia: body.dynamicMedia ?? false,
        miniAppEnabled: body.miniAppEnabled ?? false,
      },
    });
    return NextResponse.json(message, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}
