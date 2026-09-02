import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface TGPhoto { file_id: string; width: number }
interface TGVideo { file_id: string }
interface TGInlineButton { text: string; url?: string; callback_data?: string }
interface TGMessage {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  photo?: TGPhoto[];
  video?: TGVideo;
  reply_markup?: { inline_keyboard: TGInlineButton[][] };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  const { botId, channelId } = await params;

  const [bot, channel] = await Promise.all([
    prisma.bot.findUnique({ where: { id: botId } }),
    prisma.channel.findUnique({ where: { id: channelId } }),
  ]);
  if (!bot || !channel) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const updatesRes = await fetch(
    `https://api.telegram.org/bot${bot.token}/getUpdates` +
      `?allowed_updates=["channel_post"]&limit=100`
  );
  const updatesData = await updatesRes.json();

  if (!updatesData.ok) {
    if (updatesData.error_code === 409) {
      return NextResponse.json(
        { error: "Webhook ativo — novos posts são importados automaticamente pelo webhook", webhook: true },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: updatesData.description }, { status: 400 });
  }

  const updates: Array<{ channel_post?: TGMessage }> = updatesData.result;
  const msgs = updates
    .map((u) => u.channel_post)
    .filter((m): m is TGMessage => !!m && String((m as any).chat?.id) === channel.chatId);

  // Verify which existing posts still exist in Telegram
  const existingPosts = await prisma.channelPost.findMany({
    where: { channelId, telegramMsgId: { not: null }, status: { not: "deleted" } },
  });

  for (const post of existingPosts) {
    const currentButtons = post.buttons ? JSON.parse(post.buttons) : [];
    const checkRes = await fetch(`https://api.telegram.org/bot${bot.token}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channel.chatId,
        message_id: post.telegramMsgId,
        reply_markup: { inline_keyboard: currentButtons },
      }),
    });
    const checkData = await checkRes.json();
    if (!checkData.ok && checkData.description?.includes("message to edit not found")) {
      await prisma.channelPost.update({
        where: { id: post.id },
        data: { status: "deleted" },
      });
    }
  }

  let imported = 0;
  for (const msg of msgs) {
    const exists = await prisma.channelPost.findFirst({
      where: { channelId, telegramMsgId: msg.message_id },
    });
    if (exists) continue;

    const content = msg.text ?? msg.caption ?? "";
    const hasMedia = !!msg.photo?.length || !!msg.video;
    if (!content && !hasMedia) continue;

    let mediaType: string | null = null;
    let mediaUrl: string | null = null;

    if (msg.photo?.length) {
      mediaType = "photo";
      const best = msg.photo.reduce((a, b) => (a.width > b.width ? a : b));
      const fileRes = await fetch(
        `https://api.telegram.org/bot${bot.token}/getFile?file_id=${best.file_id}`
      ).then((r) => r.json());
      if (fileRes.ok) {
        mediaUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
      }
    } else if (msg.video) {
      mediaType = "video";
      const fileRes = await fetch(
        `https://api.telegram.org/bot${bot.token}/getFile?file_id=${msg.video.file_id}`
      ).then((r) => r.json());
      if (fileRes.ok) {
        mediaUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
      }
    }

    const buttons = msg.reply_markup?.inline_keyboard?.length
      ? JSON.stringify(msg.reply_markup.inline_keyboard)
      : null;

    await prisma.channelPost.create({
      data: {
        channelId,
        telegramMsgId: msg.message_id,
        content,
        parseMode: "plain",
        status: "received",
        sentAt: new Date(msg.date * 1000),
        mediaType,
        mediaUrl,
        buttons,
      },
    });
    imported++;
  }

  const posts = await prisma.channelPost.findMany({
    where: { channelId, NOT: { status: "deleted" } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ imported, posts });
}
