import { NextRequest, NextResponse } from "next/server";
import { getMTProtoClient, sendToBotFather } from "@/lib/telegram-mtproto";

// Conversa com o @BotFather via MTProto — runtime Node + tempo extra
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { botName, botUsername } = await req.json();

    if (!botName?.trim() || !botUsername?.trim()) {
      return NextResponse.json({ error: "Nome e username são obrigatórios" }, { status: 400 });
    }

    const username = botUsername.trim().replace(/^@/, "");
    if (!username.toLowerCase().endsWith("bot")) {
      return NextResponse.json(
        { error: "O username do bot deve terminar em 'bot' (ex: meu_vendas_bot)" },
        { status: 400 }
      );
    }

    const client = await getMTProtoClient();

    // Step 1: /newbot — BotFather asks for the display name
    const reply1 = await sendToBotFather(client, "/newbot");
    if (
      !reply1.toLowerCase().includes("name") &&
      !reply1.toLowerCase().includes("call it") &&
      !reply1.toLowerCase().includes("chama")
    ) {
      throw new Error(`Resposta inesperada do BotFather na etapa 1: ${reply1}`);
    }

    // Step 2: Send bot display name — BotFather asks for the username
    const reply2 = await sendToBotFather(client, botName.trim());
    if (
      !reply2.toLowerCase().includes("username") &&
      !reply2.toLowerCase().includes("nome de usuário")
    ) {
      throw new Error(`Resposta inesperada do BotFather na etapa 2: ${reply2}`);
    }

    // Step 3: Send username — BotFather replies with the token
    const reply3 = await sendToBotFather(client, username);
    const tokenMatch = reply3.match(/(\d{8,}:[A-Za-z0-9_-]{30,})/);
    if (!tokenMatch) {
      throw new Error(`BotFather: ${reply3}`);
    }

    const token = tokenMatch[1];

    // Verify with Bot API
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
    if (!meRes.ok) {
      throw new Error("Token criado mas falhou na verificação com o Telegram");
    }

    return NextResponse.json({
      token,
      name: meRes.result.first_name as string,
      username: meRes.result.username as string,
      description: "",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao criar bot";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
