import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });
    }

    const [meRes, descRes] = await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/getMe`),
      fetch(`https://api.telegram.org/bot${token}/getMyDescription`),
    ]);

    const me = await meRes.json();

    if (!me.ok) {
      return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 400 });
    }

    let description = "";
    if (descRes.ok) {
      const descData = await descRes.json();
      description = descData.result?.description ?? "";
    }

    return NextResponse.json({
      name: me.result.first_name,
      username: me.result.username,
      description,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao verificar token" }, { status: 500 });
  }
}
