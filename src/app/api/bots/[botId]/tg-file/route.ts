import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// In-memory cache for file paths (lives as long as server process)
const fileCache = new Map<string, string>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const fileId = new URL(req.url).searchParams.get("file_id");

  if (!fileId) return NextResponse.json({ error: "Missing file_id" }, { status: 400 });

  const cacheKey = `${botId}:${fileId}`;
  const cached = fileCache.get(cacheKey);
  if (cached) return NextResponse.redirect(cached, 302);

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

  const fileRes = await fetch(
    `https://api.telegram.org/bot${bot.token}/getFile?file_id=${fileId}`
  ).then((r) => r.json());

  if (!fileRes.ok) {
    return NextResponse.json({ error: fileRes.description }, { status: 400 });
  }

  const url = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
  fileCache.set(cacheKey, url);
  return NextResponse.redirect(url, 302);
}
