import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; mediaId: string }> }
) {
  try {
    const { botId, mediaId } = await params;

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media || media.botId !== botId) {
      return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });
    }

    // Delete message from storage channel if we have the info
    if (media.storageMessageId && media.storageChannelId) {
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      const storageChannel = await prisma.channel.findUnique({ where: { id: media.storageChannelId } });
      if (bot && storageChannel) {
        await fetch(`https://api.telegram.org/bot${bot.token}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: storageChannel.chatId, message_id: media.storageMessageId }),
        }).catch(() => {});
      }
    }

    await prisma.media.delete({ where: { id: mediaId } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}
