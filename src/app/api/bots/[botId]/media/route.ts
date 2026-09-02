import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateStorageChannel } from "@/lib/storage-channel";

// Upload vai pro Telegram; pode criar o storage channel via MTProto na 1ª vez
export const runtime = "nodejs";
export const maxDuration = 60;

// GET — list all media for this bot
export async function GET(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const media = await prisma.media.findMany({
      where: { botId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(media);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}

// POST — upload file to storage channel (auto-created if needed), save file_id
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;

    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    const storageChannel = await getOrCreateStorageChannel(botId);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;
    const fileSize = file.size;

    // Determine Telegram method and field
    let method: string;
    let field: string;
    let type: string;

    if (mimeType.startsWith("image/") && !mimeType.includes("gif")) {
      method = "sendPhoto"; field = "photo"; type = "photo";
    } else if (mimeType.startsWith("video/") || mimeType.includes("gif")) {
      method = "sendVideo"; field = "video"; type = "video";
    } else if (mimeType.startsWith("audio/")) {
      method = "sendAudio"; field = "audio"; type = "audio";
    } else {
      method = "sendDocument"; field = "document"; type = "document";
    }

    // Upload to Telegram storage channel via Bot API multipart
    const tgForm = new FormData();
    tgForm.append("chat_id", storageChannel.chatId);
    tgForm.append(field, new Blob([buffer], { type: mimeType }), file.name);

    const tgRes = await fetch(`https://api.telegram.org/bot${bot.token}/${method}`, {
      method: "POST",
      body: tgForm,
    }).then((r) => r.json());

    if (!tgRes.ok) {
      throw new Error(tgRes.description ?? "Erro ao enviar para o Telegram");
    }

    const result = tgRes.result;
    const messageId: number = result.message_id;

    // Extract file info from Telegram response
    let fileId: string | undefined;
    let fileUniqueId: string | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let duration: number | undefined;
    let thumbnailFileId: string | undefined;

    const tgFile = result[field] ?? (Array.isArray(result.photo) ? result.photo.at(-1) : undefined);
    if (tgFile) {
      fileId = tgFile.file_id;
      fileUniqueId = tgFile.file_unique_id;
      width = tgFile.width;
      height = tgFile.height;
      duration = tgFile.duration;
      thumbnailFileId = tgFile.thumb?.file_id ?? tgFile.thumbnail?.file_id;
    }

    const media = await prisma.media.create({
      data: {
        name: file.name,
        type,
        mimeType,
        fileSize,
        fileId: fileId ?? null,
        fileUniqueId: fileUniqueId ?? null,
        storageMessageId: messageId,
        width: width ?? null,
        height: height ?? null,
        duration: duration ?? null,
        thumbnailFileId: thumbnailFileId ?? null,
        storageChannelId: storageChannel.id,
        botId,
      },
    });

    return NextResponse.json(media, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro no upload" }, { status: 500 });
  }
}
