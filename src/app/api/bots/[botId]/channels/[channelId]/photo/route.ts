import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMTProtoClient } from "@/lib/telegram-mtproto";
import { Api } from "telegram";
import { CustomFile } from "telegram/client/uploads";

// Upload de foto de perfil via MTProto — runtime Node + tempo extra
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; channelId: string }> }
) {
  try {
    const { botId, channelId } = await params;

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("photo") as File | null;
    if (!file) return NextResponse.json({ error: "Nenhuma foto enviada" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `channel_photo_${channelId}.${ext}`;

    const client = await getMTProtoClient();
    const tgEntity = await client.getEntity(channel.chatId);

    // Upload file via MTProto
    const uploaded = await client.uploadFile({
      file: new CustomFile(fileName, buffer.length, "", buffer),
      workers: 1,
    });

    // Set as channel photo
    await client.invoke(
      new Api.channels.EditPhoto({
        channel: tgEntity,
        photo: new Api.InputChatUploadedPhoto({ file: uploaded }),
      })
    );

    // Fetch the new photo URL via Bot API to store in DB
    let photoUrl: string | null = channel.photoUrl;
    try {
      const chatRes = await fetch(`https://api.telegram.org/bot${bot.token}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channel.chatId }),
      }).then((r) => r.json());
      const fileId = chatRes.result?.photo?.big_file_id;
      if (fileId) {
        const fileRes = await fetch(
          `https://api.telegram.org/bot${bot.token}/getFile?file_id=${fileId}`
        ).then((r) => r.json());
        if (fileRes.ok) photoUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
      }
    } catch {}

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: { photoUrl, updatedAt: new Date() },
    });

    return NextResponse.json({ photoUrl: updated.photoUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar foto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
