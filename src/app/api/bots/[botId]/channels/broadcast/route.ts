/**
 * POST /api/bots/[botId]/channels/broadcast
 *
 * Sends content + per-language translations to their matching language channels,
 * then edits each sent message to add cross-link buttons pointing to the others.
 *
 * Body: {
 *   content: string          — default/fallback content
 *   parseMode?: string
 *   buttons?: unknown[][]    — original action buttons (added on top of cross-link row)
 *   translations: Record<string, string>  — { langCode: translatedContent }
 * }
 *
 * Returns: { sent: { channelId, chatId, messageId, language }[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLanguage } from "@/data/languages";

type SentEntry = {
  channelId: string;
  chatId: string;
  messageId: number;
  language: string | null;
  username: string | null;
};

async function tgSend(token: string, chatId: string, text: string, parseMode: string | undefined, buttons: unknown[][]) {
  const payload: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode && parseMode !== "plain") payload.parse_mode = parseMode;
  if (buttons.length > 0) payload.reply_markup = { inline_keyboard: buttons };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function tgEdit(token: string, chatId: string, messageId: number, text: string, parseMode: string | undefined, buttons: unknown[][]) {
  const payload: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text };
  if (parseMode && parseMode !== "plain") payload.parse_mode = parseMode;
  payload.reply_markup = { inline_keyboard: buttons };
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function channelUrl(entry: SentEntry): string {
  if (entry.username) return `https://t.me/${entry.username}/${entry.messageId}`;
  // private channel: -100XXXXXXXXX → c/XXXXXXXXX
  const numericId = entry.chatId.replace(/^-100/, "");
  return `https://t.me/c/${numericId}/${entry.messageId}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const { content, parseMode, buttons = [], translations = {} } = await req.json() as {
      content: string;
      parseMode?: string;
      buttons?: unknown[][];
      translations?: Record<string, string>;
    };

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    // Find all language-tagged channels for this bot
    const channels = await prisma.channel.findMany({
      where: { botId, botIsAdmin: true, isStorage: false },
    });

    const langChannels = channels.filter((c) => c.language);

    if (langChannels.length === 0) {
      return NextResponse.json({ error: "Nenhum canal com idioma configurado encontrado" }, { status: 400 });
    }

    const sent: SentEntry[] = [];

    // Phase 1: send each translation to the matching channel
    for (const ch of langChannels) {
      const lang = ch.language!;
      const text = translations[lang] || content;
      if (!text.trim()) continue;

      const res = await tgSend(bot.token, ch.chatId, text, parseMode, buttons);
      if (res.ok) {
        sent.push({
          channelId: ch.id,
          chatId: ch.chatId,
          messageId: res.result.message_id as number,
          language: lang,
          username: ch.username,
        });

        // Persist to DB
        await prisma.channelPost.create({
          data: {
            channelId: ch.id,
            telegramMsgId: res.result.message_id as number,
            content: text,
            parseMode: parseMode ?? "MarkdownV2",
            buttons: buttons.length > 0 ? JSON.stringify(buttons) : null,
            status: "sent",
            sentAt: new Date(),
          },
        });
      }
    }

    if (sent.length < 2) {
      // Not enough to cross-link, but we succeeded
      return NextResponse.json({ sent });
    }

    // Phase 2: edit each message to add cross-link buttons to the other channels
    for (const entry of sent) {
      const crossLinks = sent
        .filter((s) => s.channelId !== entry.channelId)
        .map((s) => {
          const lang = getLanguage(s.language ?? "");
          return { text: `${lang?.flag ?? ""} ${lang?.nativeName ?? s.language}`, url: channelUrl(s) };
        });

      const crossRow = crossLinks;
      const allButtons = [...(buttons as unknown[][]), ...(crossRow.length > 0 ? [crossRow] : [])];

      const text = translations[entry.language!] || content;
      await tgEdit(bot.token, entry.chatId, entry.messageId, text, parseMode, allButtons);
    }

    return NextResponse.json({ sent });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar broadcast";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
