import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Faz várias chamadas à Bot API por canal (admins, foto, contagem) — tempo extra
export const runtime = "nodejs";
export const maxDuration = 60;

interface TgChat {
  id: number;
  title: string;
  username?: string;
  type: string;
  member_count?: number;
}

async function fetchPhotoUrl(token: string, chatId: string): Promise<string | null> {
  try {
    const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const chatData = await chatRes.json();
    const fileId = chatData.result?.photo?.big_file_id;
    if (!fileId) return null;
    const fileRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
    ).then((r) => r.json());
    if (fileRes.ok) return `https://api.telegram.org/file/bot${token}/${fileRes.result.file_path}`;
  } catch {}
  return null;
}

async function upsertChannel(botId: string, botUserId: number, token: string, chat: TgChat) {
  const chatId = String(chat.id);

  const [adminsData, photoUrl, memberCountRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getChatAdministrators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    }).then((r) => r.json()),
    fetchPhotoUrl(token, chatId),
    fetch(`https://api.telegram.org/bot${token}/getChatMemberCount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    }).then((r) => r.json()).catch(() => null),
  ]);

  const botIsAdmin = adminsData.ok
    ? adminsData.result.some((a: { user: { id: number } }) => a.user.id === botUserId)
    : false;

  const memberCount: number | null =
    memberCountRes?.ok ? (memberCountRes.result as number) : (chat.member_count ?? null);

  return prisma.channel.upsert({
    where: { chatId_botId: { chatId, botId } },
    update: {
      title: chat.title,
      username: chat.username ?? null,
      type: chat.type,
      memberCount,
      botIsAdmin,
      ...(photoUrl && { photoUrl }),
      updatedAt: new Date(),
    },
    create: {
      chatId,
      title: chat.title,
      username: chat.username ?? null,
      type: chat.type,
      memberCount,
      botIsAdmin,
      photoUrl,
      botId,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    const meRes = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) return NextResponse.json({ error: "Token inválido" }, { status: 400 });

    const botUserId: number = meData.result.id;

    const found: TgChat[] = [];
    const errors: string[] = [];

    // ── Estratégia 1: getUpdates ──────────────────────────────────────────────
    // Funciona quando não há webhook ativo. Busca os últimos 100 updates
    // procurando my_chat_member onde o bot foi promovido a admin.
    const updatesRes = await fetch(`https://api.telegram.org/bot${bot.token}/getUpdates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit: 100,
        allowed_updates: ["my_chat_member", "channel_post", "message"],
      }),
    });
    const updatesData = await updatesRes.json();

    if (updatesData.ok) {
      const chatsSeen = new Map<number, TgChat>();

      for (const update of updatesData.result as Array<Record<string, unknown>>) {
        // my_chat_member: bot foi adicionado/promovido
        const mcm = update.my_chat_member as Record<string, unknown> | undefined;
        if (mcm) {
          const chat = mcm.chat as TgChat;
          const newStatus = (mcm.new_chat_member as Record<string, unknown>)?.status as string;
          if (
            (chat.type === "channel" || chat.type === "supergroup" || chat.type === "group") &&
            (newStatus === "administrator" || newStatus === "creator")
          ) {
            chatsSeen.set(chat.id, chat);
          }
        }

        // channel_post ou message: o bot recebeu update do canal/grupo
        const post = (update.channel_post ?? update.message) as Record<string, unknown> | undefined;
        if (post) {
          const chat = post.chat as TgChat;
          if (chat.type === "channel" || chat.type === "supergroup" || chat.type === "group") {
            chatsSeen.set(chat.id, chat);
          }
        }
      }

      found.push(...chatsSeen.values());
    } else if (updatesData.error_code === 409) {
      // Webhook ativo — getUpdates não funciona, avisa mas não para
      errors.push("Webhook ativo: getUpdates não disponível. Canais serão detectados automaticamente via webhook ao receber novas mensagens.");
    }

    // ── Estratégia 2: re-checar canais já no banco ────────────────────────────
    // Atualiza o status de admin de canais que já conhecemos
    const existing = await prisma.channel.findMany({ where: { botId, isStorage: false } });
    const existingChatIds = new Set(existing.map((c) => c.chatId));

    // Adiciona canais existentes que não foram pegos pelo getUpdates
    for (const ch of existing) {
      if (!found.some((f) => String(f.id) === ch.chatId)) {
        found.push({
          id: parseInt(ch.chatId),
          title: ch.title,
          username: ch.username ?? undefined,
          type: ch.type,
        });
      }
    }

    // ── Upsert de tudo encontrado ─────────────────────────────────────────────
    const upserted = await Promise.all(
      found.map((chat) => upsertChannel(botId, botUserId, bot.token, chat))
    );

    const newCount = upserted.filter((c) => !existingChatIds.has(c.chatId)).length;
    const updatedCount = upserted.filter((c) => existingChatIds.has(c.chatId)).length;

    const channels = await prisma.channel.findMany({
      where: { botId, isStorage: false },
      include: { _count: { select: { posts: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      channels,
      summary: {
        new: newCount,
        updated: updatedCount,
        total: channels.length,
      },
      warnings: errors,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Erro durante sincronização" }, { status: 500 });
  }
}
