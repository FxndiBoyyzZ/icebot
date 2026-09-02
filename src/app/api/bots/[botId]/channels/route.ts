import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const channels = await prisma.channel.findMany({
    where: { botId, isStorage: false },
    include: { _count: { select: { posts: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(channels);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const { identifier } = await req.json(); // @username ou -100xxxxxxxxx

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    // Busca info do canal
    const chatRes = await fetch(
      `https://api.telegram.org/bot${bot.token}/getChat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: identifier }),
      }
    );
    const chatData = await chatRes.json();
    if (!chatData.ok) {
      return NextResponse.json(
        { error: "Canal não encontrado. Verifique o username ou ID e se o bot foi adicionado ao canal." },
        { status: 400 }
      );
    }

    const chat = chatData.result;
    const chatId = String(chat.id);

    // Verifica se o bot é admin
    const adminsRes = await fetch(
      `https://api.telegram.org/bot${bot.token}/getChatAdministrators`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      }
    );
    const adminsData = await adminsRes.json();

    let botIsAdmin = false;
    if (adminsData.ok) {
      const botInfo = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`).then((r) => r.json());
      const botUserId = botInfo.result?.id;
      botIsAdmin = adminsData.result.some(
        (a: { user: { id: number } }) => a.user.id === botUserId
      );
    }

    // Fetch channel photo
    let photoUrl: string | null = null;
    try {
      const fileId = chatData.result?.photo?.big_file_id;
      if (fileId) {
        const fileRes = await fetch(
          `https://api.telegram.org/bot${bot.token}/getFile?file_id=${fileId}`
        ).then((r) => r.json());
        if (fileRes.ok) photoUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
      }
    } catch {}

    const channel = await prisma.channel.upsert({
      where: { chatId_botId: { chatId, botId } },
      update: {
        title: chat.title,
        username: chat.username ?? null,
        type: chat.type,
        memberCount: chat.member_count ?? null,
        botIsAdmin,
        ...(photoUrl && { photoUrl }),
      },
      create: {
        chatId,
        title: chat.title,
        username: chat.username ?? null,
        type: chat.type,
        memberCount: chat.member_count ?? null,
        botIsAdmin,
        photoUrl,
        botId,
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao adicionar canal" }, { status: 500 });
  }
}
