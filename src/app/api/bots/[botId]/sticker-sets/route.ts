import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const { searchParams } = new URL(req.url);
  const setName = searchParams.get("name");

  if (!setName) {
    return NextResponse.json({ error: "Nome do pack necessário" }, { status: 400 });
  }

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

  const res = await fetch(
    `https://api.telegram.org/bot${bot.token}/getStickerSet?name=${encodeURIComponent(setName)}`
  );
  const data = await res.json();

  if (!data.ok) {
    return NextResponse.json({ error: data.description }, { status: 400 });
  }

  const set = data.result;
  const stickers = (set.stickers as Array<{
    file_id: string;
    custom_emoji_id?: string;
    emoji?: string;
    thumbnail?: { file_id: string };
  }>).slice(0, 100).map((s) => ({
    custom_emoji_id: s.custom_emoji_id ?? s.file_id,
    emoji: s.emoji ?? "⭐",
    file_id: s.file_id,
    thumb_file_id: s.thumbnail?.file_id ?? null,
  }));

  return NextResponse.json({
    name: set.name,
    title: set.title,
    sticker_type: (set.sticker_type as string) ?? "regular",
    stickers,
  });
}
