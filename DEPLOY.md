# Deploy do IceBot (Vercel)

Guia completo para colocar o IceBot online 100%, acessível de qualquer lugar.

---

## O que já está pronto no código

| Item | Estado |
|---|---|
| Build de produção (`next build`) | ✅ passa |
| Proteção de acesso ao painel (HTTP Basic Auth) | ✅ `src/proxy.ts` — só falta setar `APP_PASSWORD` |
| Webhooks liberados sem senha (`/api/webhooks/*`) | ✅ |
| Timeouts das rotas MTProto/webhook (`maxDuration`) | ✅ configurados |
| Painel de status do webhook (aba **Bot**) | ✅ mostra URL atual, fila e erros; botões registrar/remover |
| `.env.example` com todas as variáveis | ✅ |
| Migrations do Prisma | ✅ rodam no build (`prisma migrate deploy`) |

## O que só você pode fazer (este guia)

Criar contas, colar chaves, apontar webhooks. ~20–30 min.

---

## Pré-requisitos

- Conta no **GitHub** (grátis)
- Conta na **Vercel** (grátis) — pode logar com o GitHub
- O banco **Neon** já existe (as connection strings estão no seu `.env` local, linhas `DATABASE_URL` e `DIRECT_URL`)
- Chaves do **Stripe** (as do `.env` são de teste `sk_test_`/`rk_test_` — pode começar com elas)
- Credenciais **Telegram MTProto** já existem no seu `.env.local` (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`)

---

## Passo 1 — Subir o código pro GitHub

No terminal, na pasta do projeto:

```bash
git add -A
git commit -m "Preparação para deploy"
```

Crie um repositório **PRIVADO** em https://github.com/new (ex: `icebot`). **Não** marque "Add a README". Depois:

```bash
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/icebot.git
git push -u origin main
```

> `.env`, `.env.local` e `*.db` estão no `.gitignore` — nenhum segredo vai pro GitHub. Confirmado.

---

## Passo 2 — Importar na Vercel

1. https://vercel.com/new
2. **Import Git Repository** → escolha o `icebot`
3. Framework: **Next.js** (detecta sozinho)
4. **Root Directory**: `.` (padrão)
5. **Build Command / Output**: deixe o padrão (a Vercel usa o `build` do `package.json`, que já roda `prisma generate && prisma migrate deploy && next build`)
6. **NÃO clique em Deploy ainda** — vá em **Environment Variables** primeiro (Passo 3)

---

## Passo 3 — Variáveis de ambiente

Em **Settings → Environment Variables**, adicione uma a uma. Marque os 3 ambientes (Production, Preview, Development) em todas, exceto onde indicado.

### Obrigatórias

| Nome | Valor | De onde tirar |
|---|---|---|
| `DATABASE_URL` | `postgresql://…-pooler….neon.tech/neondb?sslmode=require&pgbouncer=true` | linha do seu `.env` local |
| `DIRECT_URL` | `postgresql://…(sem -pooler)….neon.tech/neondb?sslmode=require` | linha do seu `.env` local |
| `APP_PASSWORD` | senha forte que você escolher | gere com `openssl rand -base64 24` |
| `STRIPE_SECRET_KEY` | `sk_test_…` ou `rk_test_…` (depois troca por `sk_live_…`) | painel Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | **Passo 5** (preencha depois com um valor placeholder por enquanto: `whsec_placeholder`) |
| `TELEGRAM_API_ID` | número | seu `.env.local` |
| `TELEGRAM_API_HASH` | hash | seu `.env.local` |
| `TELEGRAM_SESSION` | string longa `1AQAO…` | seu `.env.local` — **só em Production** se quiser restringir |
| `NEXT_PUBLIC_APP_URL` | **deixe em branco por enquanto** — preenche no Passo 4 | — |

### Opcionais

| Nome | Valor | Quando |
|---|---|---|
| `APP_USER` | `admin` (ou outro) | só se quiser mudar o usuário do login |

### Não precisa cadastrar

`CLERK_*`, `PUSHER_*`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `BLOB_READ_WRITE_TOKEN` — são dependências instaladas mas **sem uso no código hoje**. `NODE_ENV` a Vercel define sozinha.

---

## Passo 4 — Primeiro deploy e a URL

1. Clique **Deploy**. Espera ~2–4 min.
2. Ao terminar, a Vercel te dá uma URL tipo `https://icebot-abc123.vercel.app`.
3. Volte em **Settings → Environment Variables** e edite `NEXT_PUBLIC_APP_URL`:
   ```
   NEXT_PUBLIC_APP_URL = https://icebot-abc123.vercel.app
   ```
   (sem barra no final)
4. **Deployments → … no último deploy → Redeploy** (essa variável é embutida no build, precisa reconstruir).

> Se for usar domínio próprio (Passo 7), pule pra lá antes de fixar essa URL.

---

## Passo 5 — Webhook do Stripe

1. Painel Stripe → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://SEU-DOMINIO/api/webhooks/stripe`
3. Eventos a escutar: no mínimo `checkout.session.completed` (adicione `invoice.paid` e `customer.subscription.deleted` se for usar assinatura recorrente)
4. Após criar, copie o **Signing secret** (`whsec_…`)
5. Vercel → Environment Variables → edite `STRIPE_WEBHOOK_SECRET` com esse valor
6. **Redeploy**

---

## Passo 6 — Webhook do Telegram (para cada bot)

Agora que `NEXT_PUBLIC_APP_URL` é real:

1. Acesse `https://SEU-DOMINIO` → login (usuário `admin`, senha = `APP_PASSWORD`)
2. Abra o bot → aba **Bot**
3. No card **Webhook do Telegram** você vê o status atual (deve estar "Nenhum webhook registrado")
4. Clique **Registrar webhook**
5. O status deve virar **"Webhook ativo e correto"** ✅
6. Manda `/start` pro bot no Telegram — a mensagem de boas-vindas deve chegar

Repita para cada bot. Se um bot já tinha webhook numa URL antiga (ngrok), o botão **Re-registrar** corrige.

---

## Passo 7 — Domínio próprio (opcional)

1. Vercel → projeto → **Settings → Domains → Add** → digite `painel.seudominio.com`
2. Adicione o registro DNS que a Vercel mostrar (CNAME) no seu provedor de domínio
3. Quando propagar, edite `NEXT_PUBLIC_APP_URL` pra `https://painel.seudominio.com`
4. **Redeploy**
5. Refaça o **Passo 5** (endpoint Stripe) e o **Passo 6** (re-registrar webhook de cada bot) com o novo domínio

---

## Verificação final

- [ ] `https://SEU-DOMINIO` pede usuário/senha e entra
- [ ] `https://SEU-DOMINIO/api/webhooks/telegram/qualquer-coisa` **não** pede senha (retorna JSON) — confirma que webhooks estão liberados
- [ ] Aba **Bot** → webhook "ativo e correto"
- [ ] `/start` no bot responde
- [ ] Um pagamento de teste no Stripe cai em **Pagamentos** e o cliente recebe o link do canal

---

## Manutenção

**Deploy de novas versões:** `git push` na branch `main` → a Vercel builda e publica sozinha.

**Novas migrations do Prisma:** rode `npx prisma migrate dev --name descricao` local, commite a pasta `prisma/migrations/`, dê push. O build na Vercel roda `prisma migrate deploy` automaticamente.

**Logs:** Vercel → projeto → **Logs** (runtime) ou **Deployments → Build Logs**.

**Trocar a senha do painel:** edite `APP_PASSWORD` na Vercel → Redeploy.

---

## Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| Painel responde **503 "APP_PASSWORD não configurada"** | variável não setada em Production | cadastre `APP_PASSWORD` e redeploy |
| Bot não responde `/start` | webhook não registrado ou URL errada | aba Bot → status do webhook → Registrar/Re-registrar |
| Webhook mostra "aponta para outra URL" | `NEXT_PUBLIC_APP_URL` mudou | clique **Re-registrar webhook** |
| Erro de build `P3005` ou migrations | `DIRECT_URL` ausente/errada | confira a connection string **sem** `-pooler` |
| `criar bot via BotFather` / `clonar` dá timeout | operação MTProto passou de 60s (plano Hobby) | tente de novo; se recorrente, upgrade pra Pro (limite 300s) |
| Stripe webhook falha com "signature" | `STRIPE_WEBHOOK_SECRET` errado | copie de novo do painel Stripe do endpoint certo |
| Muitos `prisma:error … Closed` nos logs | conexões ociosas do Neon | normal com o pooler; se ficar pesado, considere o adapter `@prisma/adapter-neon` |

---

## ⚠️ Sobre segurança

O painel está protegido por **HTTP Basic Auth** (`src/proxy.ts`) — uma senha única, suficiente para um admin só. **Não é multiusuário.** Se no futuro precisar de contas separadas, times, ou signup de clientes, aí sim vale ligar o Clerk (já está no `package.json`, só precisa ser implementado).

A `TELEGRAM_SESSION` dá **acesso total** à conta de serviço do Telegram. Ela só existe como env var na Vercel (nunca no Git). Se suspeitar de vazamento, rode `scripts/auth-telegram.ts` de novo pra invalidar a antiga.
