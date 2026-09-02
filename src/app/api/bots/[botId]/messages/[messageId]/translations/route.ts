import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { translateOne } from "@/lib/translate";

type TranslationEntry = { content: string; auto?: boolean; updatedAt?: string; buttons?: unknown[][] };

// GET — return parsed translations object
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { translations: true } });
  const translations: Record<string, TranslationEntry> = msg?.translations
    ? JSON.parse(msg.translations)
    : {};
  return NextResponse.json(translations);
}

// PATCH — upsert a single translation (manual save or auto-generate)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; messageId: string }> }
) {
  const { messageId } = await params;
  const { lang, content: manualContent, auto = false } = await req.json();
  if (!lang) return NextResponse.json({ error: "lang required" }, { status: 400 });

  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { translations: true, content: true },
  });
  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const translations: Record<string, TranslationEntry> = msg.translations
    ? JSON.parse(msg.translations)
    : {};

  let finalContent = manualContent;

  // If no manual content provided, auto-translate from base
  if (!finalContent) {
    finalContent = await translateOne(msg.content, lang);
  }

  translations[lang] = {
    content: finalContent,
    auto: !manualContent || auto,
    updatedAt: new Date().toISOString(),
  };

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { translations: JSON.stringify(translations) },
    select: { translations: true },
  });

  return NextResponse.json(updated.translations ? JSON.parse(updated.translations) : {});
}

// DELETE — remove a single language translation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const { lang } = await req.json();
  if (!lang) return NextResponse.json({ error: "lang required" }, { status: 400 });

  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { translations: true } });
  const translations: Record<string, TranslationEntry> = msg?.translations
    ? JSON.parse(msg.translations)
    : {};

  delete translations[lang];

  await prisma.message.update({
    where: { id: messageId },
    data: { translations: JSON.stringify(translations) },
  });

  return NextResponse.json({ ok: true });
}
