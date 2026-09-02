import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/utils";

export const runtime = "nodejs";

// GET — status atual do webhook direto do Telegram (getWebhookInfo)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    const info = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`).then((r) => r.json());
    if (!info.ok) return NextResponse.json({ error: info.description ?? "Erro" }, { status: 400 });

    const expectedUrl = appUrl() ? `${appUrl()}/api/webhooks/telegram/${botId}` : null;

    return NextResponse.json({
      url: info.result.url || "",
      pendingUpdateCount: info.result.pending_update_count ?? 0,
      lastErrorMessage: info.result.last_error_message ?? null,
      lastErrorDate: info.result.last_error_date ?? null,
      expectedUrl,
      matches: !!expectedUrl && info.result.url === expectedUrl,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}

// POST — registra o webhook apontando para NEXT_PUBLIC_APP_URL
export async function POST(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    const base = appUrl();
    if (!base) return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL não configurada" }, { status: 500 });

    const webhookUrl = `${base}/api/webhooks/telegram/${botId}`;

    const data = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query", "channel_post", "my_chat_member"],
        drop_pending_updates: false,
      }),
    }).then((r) => r.json());

    if (!data.ok) return NextResponse.json({ error: data.description }, { status: 400 });

    await prisma.bot.update({ where: { id: botId }, data: { webhookSet: true } });
    return NextResponse.json({ ok: true, webhookUrl });
  } catch {
    return NextResponse.json({ error: "Erro ao configurar webhook" }, { status: 500 });
  }
}

// DELETE — remove o webhook do Telegram
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });

    const data = await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`, {
      method: "POST",
    }).then((r) => r.json());

    if (!data.ok) return NextResponse.json({ error: data.description }, { status: 400 });

    await prisma.bot.update({ where: { id: botId }, data: { webhookSet: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao remover webhook" }, { status: 500 });
  }
}
