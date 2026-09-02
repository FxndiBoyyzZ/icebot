import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string; postId: string }> }
) {
  try {
    const { botId, channelId, postId } = await params;

    const [bot, channel, post] = await Promise.all([
      prisma.bot.findUnique({ where: { id: botId } }),
      prisma.channel.findUnique({ where: { id: channelId } }),
      prisma.channelPost.findUnique({ where: { id: postId } }),
    ]);
    if (!bot || !channel || !post) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    if (!post.telegramMsgId) {
      return NextResponse.json({ error: "Mensagem ainda não enviada ao Telegram" }, { status: 400 });
    }

    // Detecta multipart ou JSON
    // For "received" posts (sent by humans from Telegram): delete original + resend as bot message
    const contentType = req.headers.get("content-type") ?? "";
    let content = "";
    let parseMode = post.parseMode;
    let buttons: string | undefined;
    let newMediaFile: File | null = null;
    let newMediaUrl: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      content = (form.get("content") as string) ?? post.content;
      parseMode = (form.get("parseMode") as string) ?? post.parseMode;
      buttons = (form.get("buttons") as string) || undefined;
      newMediaFile = form.get("image") as File | null;
      newMediaUrl = (form.get("imageUrl") as string) || null;
    } else {
      const body = await req.json();
      content = body.content ?? post.content;
      parseMode = body.parseMode ?? post.parseMode;
      buttons = body.buttons;
    }

    const replyMarkup = buttons ? { inline_keyboard: JSON.parse(buttons) } : undefined;
    const validParseModes = ["HTML", "Markdown", "MarkdownV2"];
    const effectiveParseMode = validParseModes.includes(parseMode ?? "") ? parseMode : undefined;

    // ── Received posts: delete original + resend as bot message ────────────
    if (post.status === "received") {
      // Try to delete the original human-sent message
      await fetch(`https://api.telegram.org/bot${bot.token}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channel.chatId, message_id: post.telegramMsgId }),
      });

      // Resend as bot message (with buttons)
      const isMedia = post.mediaType === "photo" || post.mediaType === "video";
      let newMsgId: number | null = null;
      let newMediaUrl: string | null = post.mediaUrl;

      if (isMedia && post.mediaUrl) {
        const tgForm = new FormData();
        tgForm.append("chat_id", channel.chatId);
        if (content) { tgForm.append("caption", content); if (effectiveParseMode) tgForm.append("parse_mode", effectiveParseMode); }
        if (replyMarkup) tgForm.append("reply_markup", JSON.stringify(replyMarkup));
        tgForm.append(post.mediaType === "video" ? "video" : "photo", post.mediaUrl);
        const tgRes = await fetch(
          `https://api.telegram.org/bot${bot.token}/send${post.mediaType === "video" ? "Video" : "Photo"}`,
          { method: "POST", body: tgForm }
        );
        const tgData = await tgRes.json();
        if (!tgData.ok) return NextResponse.json({ error: `Telegram: ${tgData.description}` }, { status: 400 });
        newMsgId = tgData.result.message_id;
      } else {
        const payload: Record<string, unknown> = {
          chat_id: channel.chatId,
          text: content,
          ...(effectiveParseMode && { parse_mode: effectiveParseMode }),
        };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const tgData = await tgRes.json();
        if (!tgData.ok) return NextResponse.json({ error: `Telegram: ${tgData.description}` }, { status: 400 });
        newMsgId = tgData.result.message_id;
      }

      const updated = await prisma.channelPost.update({
        where: { id: postId },
        data: { content, parseMode, buttons: buttons ?? null, telegramMsgId: newMsgId, mediaUrl: newMediaUrl, status: "sent" },
      });
      return NextResponse.json(updated);
    }

    const isMediaPost = post.mediaType === "photo" || post.mediaType === "video";
    const mediaKind = (post.mediaType as "photo" | "video") ?? "photo";
    const changingMedia = newMediaFile || newMediaUrl;
    let savedMediaUrl = post.mediaUrl;

    if (isMediaPost && changingMedia) {
      // Troca mídia + legenda: editMessageMedia
      const tgForm = new FormData();
      tgForm.append("chat_id", channel.chatId);
      tgForm.append("message_id", String(post.telegramMsgId));

      const media: Record<string, unknown> = {
        type: mediaKind,
        caption: content,
        ...(effectiveParseMode && { parse_mode: effectiveParseMode }),
      };

      if (newMediaFile) {
        tgForm.append("media_file", newMediaFile, newMediaFile.name);
        media.media = "attach://media_file";
      } else if (newMediaUrl) {
        media.media = newMediaUrl;
        savedMediaUrl = newMediaUrl;
      }

      tgForm.append("media", JSON.stringify(media));
      if (replyMarkup) tgForm.append("reply_markup", JSON.stringify(replyMarkup));

      const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/editMessageMedia`, {
        method: "POST",
        body: tgForm,
      });
      const tgData = await tgRes.json();
      if (!tgData.ok) {
        return NextResponse.json({ error: `Telegram: ${tgData.description}` }, { status: 400 });
      }

      if (mediaKind === "photo") {
        const photos: Array<{ file_id: string; width: number }> = tgData.result?.photo ?? [];
        if (photos.length > 0) {
          const best = photos.reduce((a, b) => (a.width > b.width ? a : b));
          const fileRes = await fetch(
            `https://api.telegram.org/bot${bot.token}/getFile?file_id=${best.file_id}`
          ).then((r) => r.json());
          if (fileRes.ok) {
            savedMediaUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
          }
        }
      } else {
        const video = tgData.result?.video;
        if (video?.file_id) {
          const fileRes = await fetch(
            `https://api.telegram.org/bot${bot.token}/getFile?file_id=${video.file_id}`
          ).then((r) => r.json());
          if (fileRes.ok) {
            savedMediaUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
          }
        }
      }
    } else if (isMediaPost) {
      // Só edita legenda
      const payload: Record<string, unknown> = {
        chat_id: channel.chatId,
        message_id: post.telegramMsgId,
        caption: content,
        ...(effectiveParseMode && { parse_mode: effectiveParseMode }),
      };
      if (replyMarkup) payload.reply_markup = replyMarkup;

      const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/editMessageCaption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const tgData = await tgRes.json();
      if (!tgData.ok) {
        return NextResponse.json({ error: `Telegram: ${tgData.description}` }, { status: 400 });
      }
    } else {
      // Mensagem de texto pura
      const payload: Record<string, unknown> = {
        chat_id: channel.chatId,
        message_id: post.telegramMsgId,
        text: content,
        ...(effectiveParseMode && { parse_mode: effectiveParseMode }),
      };
      if (replyMarkup) payload.reply_markup = replyMarkup;

      const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const tgData = await tgRes.json();
      if (!tgData.ok) {
        return NextResponse.json({ error: `Telegram: ${tgData.description}` }, { status: 400 });
      }
    }

    const updated = await prisma.channelPost.update({
      where: { id: postId },
      data: {
        content,
        parseMode,
        buttons: buttons ?? null,
        mediaUrl: savedMediaUrl,
        status: "edited",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Edit post error:", error);
    return NextResponse.json({ error: "Erro ao editar post" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string; postId: string }> }
) {
  const { postId } = await params;
  await prisma.channelPost.delete({ where: { id: postId } });
  return NextResponse.json({ ok: true });
}
