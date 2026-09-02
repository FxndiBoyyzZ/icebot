import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  const { channelId } = await params;
  const posts = await prisma.channelPost.findMany({
    where: { channelId, NOT: { status: "deleted" } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(posts);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  try {
    const { botId, channelId } = await params;

    const [bot, channel] = await Promise.all([
      prisma.bot.findUnique({ where: { id: botId } }),
      prisma.channel.findUnique({ where: { id: channelId } }),
    ]);
    if (!bot || !channel) {
      return NextResponse.json({ error: "Bot ou canal não encontrado" }, { status: 404 });
    }

    // Detecta se é multipart (tem imagem) ou JSON (só texto)
    const contentType = req.headers.get("content-type") ?? "";
    let content = "";
    let parseMode = "MarkdownV2";
    let buttons: string | undefined;
    let sendNow = false;
    let mediaFile: File | null = null;
    let mediaUrl: string | null = null;
    let fileMediaType: "photo" | "video" = "photo";
    let entities: unknown[] | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      content = (form.get("content") as string) ?? "";
      parseMode = (form.get("parseMode") as string) ?? "MarkdownV2";
      buttons = (form.get("buttons") as string) || undefined;
      sendNow = form.get("sendNow") === "true";
      mediaFile = (form.get("image") as File | null);
      mediaUrl = (form.get("imageUrl") as string) || null;
      fileMediaType = (form.get("fileMediaType") as "photo" | "video") || "photo";
      const entitiesRaw = form.get("entities") as string | null;
      if (entitiesRaw) entities = JSON.parse(entitiesRaw);
    } else {
      const body = await req.json();
      content = body.content ?? "";
      parseMode = body.parseMode ?? "MarkdownV2";
      buttons = body.buttons;
      sendNow = body.sendNow ?? false;
      mediaUrl = body.imageUrl ?? null;
      entities = body.entities;
    }

    const hasEntities = Array.isArray(entities) && entities.length > 0;

    let telegramMsgId: number | undefined;
    let status = "draft";
    let savedMediaUrl: string | null = mediaUrl;
    const mediaType = mediaFile || mediaUrl ? fileMediaType : null;

    if (sendNow) {
      const hasMedia = mediaFile || mediaUrl;
      const replyMarkup = buttons ? { inline_keyboard: JSON.parse(buttons) } : undefined;

      if (hasMedia) {
        const tgForm = new FormData();
        tgForm.append("chat_id", channel.chatId);
        if (content) {
          tgForm.append("caption", content);
          // Use caption_entities for media messages with custom emoji
          if (hasEntities) {
            tgForm.append("caption_entities", JSON.stringify(entities));
          } else {
            tgForm.append("parse_mode", parseMode);
          }
        }
        if (replyMarkup) {
          tgForm.append("reply_markup", JSON.stringify(replyMarkup));
        }

        if (fileMediaType === "video") {
          if (mediaFile) tgForm.append("video", mediaFile, mediaFile.name);
          else if (mediaUrl) tgForm.append("video", mediaUrl);

          const tgRes = await fetch(
            `https://api.telegram.org/bot${bot.token}/sendVideo`,
            { method: "POST", body: tgForm }
          );
          const tgData = await tgRes.json();
          if (!tgData.ok) {
            return NextResponse.json({ error: `Telegram: ${tgData.description}` }, { status: 400 });
          }
          telegramMsgId = tgData.result.message_id;
          status = "sent";

          const video = tgData.result.video;
          if (video?.file_id) {
            const fileRes = await fetch(
              `https://api.telegram.org/bot${bot.token}/getFile?file_id=${video.file_id}`
            ).then((r) => r.json());
            if (fileRes.ok) {
              savedMediaUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
            }
          }
        } else {
          // sendPhoto
          if (mediaFile) tgForm.append("photo", mediaFile, mediaFile.name);
          else if (mediaUrl) tgForm.append("photo", mediaUrl);

          const tgRes = await fetch(
            `https://api.telegram.org/bot${bot.token}/sendPhoto`,
            { method: "POST", body: tgForm }
          );
          const tgData = await tgRes.json();
          if (!tgData.ok) {
            return NextResponse.json({ error: `Telegram: ${tgData.description}` }, { status: 400 });
          }
          telegramMsgId = tgData.result.message_id;
          status = "sent";

          const photos: Array<{ file_id: string; width: number }> = tgData.result.photo ?? [];
          if (photos.length > 0) {
            const best = photos.reduce((a, b) => (a.width > b.width ? a : b));
            const fileRes = await fetch(
              `https://api.telegram.org/bot${bot.token}/getFile?file_id=${best.file_id}`
            ).then((r) => r.json());
            if (fileRes.ok) {
              savedMediaUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
            }
          }
        }
      } else {
        // sendMessage
        const payload: Record<string, unknown> = {
          chat_id: channel.chatId,
          text: content,
        };
        if (hasEntities) {
          payload.entities = entities;
        } else {
          payload.parse_mode = parseMode;
        }
        if (replyMarkup) payload.reply_markup = replyMarkup;

        const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const tgData = await tgRes.json();

        if (!tgData.ok) {
          return NextResponse.json({ error: `Telegram: ${tgData.description}` }, { status: 400 });
        }

        telegramMsgId = tgData.result.message_id;
        status = "sent";
      }
    }

    const post = await prisma.channelPost.create({
      data: {
        content,
        parseMode,
        buttons: buttons ?? null,
        mediaUrl: savedMediaUrl,
        mediaType,
        status,
        telegramMsgId: telegramMsgId ?? null,
        sentAt: sendNow ? new Date() : null,
        channelId,
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Post error:", error);
    return NextResponse.json({ error: "Erro ao criar post" }, { status: 500 });
  }
}
