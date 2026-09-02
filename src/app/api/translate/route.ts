import { NextRequest, NextResponse } from "next/server";
import { translateOne } from "@/lib/translate";

export async function POST(req: NextRequest) {
  try {
    const { content, targetLangs, parseMode = "MarkdownV2" } = await req.json();

    if (!content || !Array.isArray(targetLangs) || targetLangs.length === 0) {
      return NextResponse.json({ error: "content e targetLangs são obrigatórios" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      targetLangs.map(async (lang: string) => ({
        lang,
        content: await translateOne(content, lang, parseMode),
      }))
    );

    const translations: Record<string, string> = {};
    const errors: Record<string, string> = {};

    for (const result of results) {
      if (result.status === "fulfilled") {
        translations[result.value.lang] = result.value.content;
      } else {
        errors["unknown"] = (result.reason as Error)?.message ?? "Erro desconhecido";
      }
    }

    return NextResponse.json({ translations, errors });
  } catch (error) {
    console.error("Translate error:", error);
    return NextResponse.json({ error: "Erro ao traduzir" }, { status: 500 });
  }
}
