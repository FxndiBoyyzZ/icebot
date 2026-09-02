import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (ex-"middleware" no Next <=15) — roda antes de toda request.
 *
 * Protege TODO o painel e a API com HTTP Basic Auth, exceto:
 *  - /api/webhooks/*  → Telegram e Stripe precisam chamar sem credencial
 *  - assets do Next (_next/static, _next/image, favicon)
 *
 * Config necessária em produção:
 *  APP_USER      (opcional, default "admin")
 *  APP_PASSWORD  (obrigatório — sem ela, produção responde 503)
 *
 * Em desenvolvimento, se APP_PASSWORD não estiver setada, libera tudo.
 */

const PUBLIC_PREFIXES = ["/api/webhooks/"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Webhooks externos (Telegram/Stripe) — sempre liberados
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const user = process.env.APP_USER || "admin";
  const password = process.env.APP_PASSWORD;

  if (!password) {
    // Sem senha configurada: ok em dev, bloqueia em produção (fail-closed)
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "APP_PASSWORD não configurada. Defina a variável de ambiente para liberar o acesso.",
        { status: 503 },
      );
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");
  const expected = `Basic ${btoa(`${user}:${password}`)}`;

  if (header && safeEqual(header, expected)) {
    return NextResponse.next();
  }

  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="IceBot", charset="UTF-8"' },
  });
}

// Comparação de tempo constante para não vazar o tamanho/prefixo da credencial
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  // Roda em tudo, menos assets estáticos do Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
