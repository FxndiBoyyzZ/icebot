import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const body = await req.json();
    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
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
    return NextResponse.json(message);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string; messageId: string }> }
) {
  const { messageId } = await params;
  await prisma.message.delete({ where: { id: messageId } });
  return NextResponse.json({ ok: true });
}
