import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { translateMany } from "@/lib/translate";

export type BlastResult = {
  channelId: string;
  chatId: string;
  title: string;
  language: string | null;
  ok: boolean;
  messageId?: number;
  translated?: boolean;
  error?: string;
};

type InlineButton = { text: string; url: string };

async function sendToChannel(
  token: string,
  chatId: string,
  text: string,
  parseMode: string,
  buttons: InlineButton[],
  mediaFileId?: string,
  mediaType?: string,
) {
  const replyMarkup = buttons.length > 0
    ? { inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]) }
    : undefined;

  if (mediaFileId && mediaType) {
    const method = mediaType === "photo" ? "sendPhoto"
      : mediaType === "video" ? "sendVideo"
      : mediaType === "audio" ? "sendAudio"
      : "sendDocument";

    const mediaField = mediaType === "photo" ? "photo"
      : mediaType === "video" ? "video"
      : mediaType === "audio" ? "audio"
      : "document";

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      [mediaField]: mediaFileId,
      caption: text || undefined,
    };
    if (parseMode && parseMode !== "plain") payload.parse_mode = parseMode;
    if (replyMarkup) payload.reply_markup = replyMarkup;

    return fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
  }

  // Text-only message
  const payload: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode && parseMode !== "plain") payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const {
      content = "",
      parseMode = "plain",
      channelIds,
      buttons = [],
      mediaFileId,
      mediaType,
    } = await req.json() as {
      content?: string;
      parseMode?: string;
      channelIds?: string[];
      buttons?: InlineButton[];
      mediaFileId?: string;
      mediaType?: string;
    };

    if (!content.trim() && !mediaFileId) {
      return NextResponse.json({ error: "Mensagem ou mídia obrigatória" }, { status: 400 });
    }

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    const where = channelIds?.length
      ? { botId, botIsAdmin: true, id: { in: channelIds } }
      : { botId, botIsAdmin: true };

    const channels = await prisma.channel.findMany({ where: { ...where, isStorage: false } });

    if (channels.length === 0) {
      return NextResponse.json({ error: "Nenhum canal elegível encontrado" }, { status: 400 });
    }

    // Translate caption/text per language (skip "en" and channels without language)
    const langsToTranslate = content.trim()
      ? [...new Set(channels.map((c) => c.language).filter((l): l is string => !!l && l !== "en"))]
      : [];

    const translations: Record<string, string> = langsToTranslate.length > 0
      ? await translateMany(content, langsToTranslate, parseMode)
      : {};

    const results: BlastResult[] = [];

    for (const ch of channels) {
      const text = (ch.language && ch.language !== "en" && translations[ch.language])
        ? translations[ch.language]
        : content;
      const translated = !!(ch.language && ch.language !== "en" && translations[ch.language]);

      try {
        const res = await sendToChannel(bot.token, ch.chatId, text, parseMode, buttons, mediaFileId, mediaType);

        if (res.ok) {
          const messageId = res.result.message_id as number;
          await prisma.channelPost.create({
            data: {
              channelId: ch.id,
              telegramMsgId: messageId,
              content: text,
              parseMode,
              status: "sent",
              sentAt: new Date(),
            },
          });
          results.push({ channelId: ch.id, chatId: ch.chatId, title: ch.title, language: ch.language, ok: true, messageId, translated });
        } else {
          results.push({ channelId: ch.id, chatId: ch.chatId, title: ch.title, language: ch.language, ok: false, error: res.description, translated });
        }
      } catch (err: unknown) {
        results.push({ channelId: ch.id, chatId: ch.chatId, title: ch.title, language: ch.language, ok: false, error: err instanceof Error ? err.message : "Erro", translated: false });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao enviar" }, { status: 500 });
  }
}
