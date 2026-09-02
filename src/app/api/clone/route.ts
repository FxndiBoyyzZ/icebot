import { NextRequest, NextResponse } from "next/server";
import { cloneBot, analyzeBotSteps } from "@/lib/bot-cloner";

// gramjs (MTProto) precisa do runtime Node e de tempo — scraping via polling
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { username } = await req.json();
  if (!username) return NextResponse.json({ error: "username obrigatório" }, { status: 400 });

  try {
    const steps = await cloneBot(username);
    const analysis = analyzeBotSteps(steps);
    return NextResponse.json({ steps, analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao clonar bot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
