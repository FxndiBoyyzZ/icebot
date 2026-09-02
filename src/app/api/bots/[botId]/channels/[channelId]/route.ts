import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMTProtoClient } from "@/lib/telegram-mtproto";
import { Api } from "telegram";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  const { channelId } = await params;
  const body = await req.json();

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });

  const dbUpdate: Record<string, unknown> = {};
  if (body.language !== undefined) dbUpdate.language = body.language || null;

  // MTProto edits for title and username
  if (body.title !== undefined || body.username !== undefined) {
    try {
      const client = await getMTProtoClient();
      const tgEntity = await client.getEntity(channel.chatId);

      if (body.title && body.title.trim() !== channel.title) {
        await client.invoke(
          new Api.channels.EditTitle({ channel: tgEntity, title: body.title.trim() })
        );
        dbUpdate.title = body.title.trim();
      }

      if (body.username !== undefined) {
        const newUsername = (body.username as string).replace(/^@/, "").trim();
        await client.invoke(
          new Api.channels.UpdateUsername({ channel: tgEntity, username: newUsername })
        );
        dbUpdate.username = newUsername || null;
      }

      if (body.about !== undefined) {
        await client.invoke(
          new Api.messages.EditChatAbout({ peer: tgEntity, about: body.about as string })
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro MTProto";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  dbUpdate.updatedAt = new Date();
  const updated = await prisma.channel.update({ where: { id: channelId }, data: dbUpdate });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  const { channelId } = await params;

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });

  // Delete from Telegram via MTProto
  try {
    const client = await getMTProtoClient();
    const tgEntity = await client.getEntity(channel.chatId);
    await client.invoke(new Api.channels.DeleteChannel({ channel: tgEntity }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro MTProto";
    return NextResponse.json({ error: `Erro ao deletar canal no Telegram: ${msg}` }, { status: 500 });
  }

  await prisma.channel.delete({ where: { id: channelId } });
  return NextResponse.json({ ok: true });
}
