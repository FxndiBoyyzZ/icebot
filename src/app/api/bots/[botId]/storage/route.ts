import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateStorageChannel } from "@/lib/storage-channel";

// GET — canal de storage atual + candidatos (grupos/canais onde o bot é admin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const channels = await prisma.channel.findMany({
    where: { botId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    current: channels.find((c) => c.isStorage) ?? null,
    candidates: channels
      .filter((c) => c.botIsAdmin && !c.isStorage)
      .map((c) => ({ id: c.id, title: c.title, username: c.username, type: c.type, memberCount: c.memberCount })),
  });
}

// PUT — define um grupo/canal existente (onde o bot já é admin) como storage
export async function PUT(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const { channelId } = await req.json();
    if (!channelId) return NextResponse.json({ error: "channelId obrigatório" }, { status: 400 });

    const [bot, channel] = await Promise.all([
      prisma.bot.findUnique({ where: { id: botId } }),
      prisma.channel.findUnique({ where: { id: channelId } }),
    ]);
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });
    if (!channel || channel.botId !== botId) {
      return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });
    }

    // Confirma ao vivo que o bot é admin e pode enviar mensagens nesse chat
    const me = await fetch(`https://api.telegram.org/bot${bot.token}/getMe`).then((r) => r.json());
    if (!me.ok) return NextResponse.json({ error: "Token do bot inválido" }, { status: 400 });

    const member = await fetch(`https://api.telegram.org/bot${bot.token}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channel.chatId, user_id: me.result.id }),
    }).then((r) => r.json());

    const status = member.ok ? member.result.status : null;
    const canPost =
      status === "creator" ||
      (status === "administrator" &&
        // can_post_messages só existe em canais; em grupos admin já pode enviar
        (channel.type === "channel" ? member.result.can_post_messages !== false : true));

    if (!canPost) {
      return NextResponse.json(
        { error: "O bot precisa ser administrador desse grupo com permissão para enviar mensagens." },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.channel.updateMany({ where: { botId, isStorage: true }, data: { isStorage: false } }),
      prisma.channel.update({ where: { id: channelId }, data: { isStorage: true, botIsAdmin: true } }),
    ]);

    return NextResponse.json({ current: await prisma.channel.findUnique({ where: { id: channelId } }) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}

// POST — cria um canal dedicado automaticamente (fallback, quando não há grupo)
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const channel = await getOrCreateStorageChannel(botId);
    return NextResponse.json({ current: channel });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}
