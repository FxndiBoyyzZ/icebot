import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LANG_NAMES } from "@/lib/translate";
import { appUrl } from "@/lib/utils";

// /start pode disparar tradução via Anthropic + envio de mensagens
export const runtime = "nodejs";
export const maxDuration = 30;

const KNOWN_LANGS = new Set(Object.keys(LANG_NAMES));

// Parses "/start PAYLOAD" into { langCode, source }
// Supports: "/start pt", "/start tw_bio", "/start pt_tw_bio", "/start fr_ig_story"
function parseStartParam(param: string | undefined): { langCode: string | null; source: string | null } {
  if (!param) return { langCode: null, source: null };
  const p = param.toLowerCase();
  const parts = p.split("_");
  if (parts[0]?.match(/^[a-z]{2}$/) && KNOWN_LANGS.has(parts[0])) {
    return {
      langCode: parts[0],
      source: parts.length > 1 ? parts.slice(1).join("_") : null,
    };
  }
  return { langCode: null, source: p };
}

type TranslationMap = Record<string, { content: string; buttons?: unknown[][]; auto?: boolean; updatedAt?: string }>;
type RedirectButton = { text: string; url: string; enabled?: boolean };

// ── helpers ──────────────────────────────────────────────────────────────────

async function tgPost(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) console.error(`[tg] ${method} failed:`, JSON.stringify(data));
  return data;
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function replaceVars(s: string, from: { first_name?: string; username?: string }): string {
  return s
    .replace(/\{nome\}/g, from.first_name ?? "")
    .replace(/\{username\}/g, from.username ? `@${from.username}` : from.first_name ?? "");
}

// Preço mostrado direto em BRL, sem conversão. priceBRL tem prioridade; senão usa
// `price` tratado como centavos de real (setup BR).
function planPriceBRL(plan: { price: number; priceBRL: number | null }): string {
  const cents = plan.priceBRL ?? plan.price;
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

type WelcomeMsg = {
  content: string;
  parseMode: string;
  buttons: string | null;
  mediaIds: string | null;
  secondaryEnabled: boolean;
  secondaryContent: string | null;
};
type PlanLite = { id: string; name: string; price: number; priceBRL: number | null };
type TgFrom = { id: number; first_name?: string; username?: string; last_name?: string };

// Monta e envia a mensagem de boas-vindas: mídia (foto/vídeo) + texto como legenda
// + um botão por plano. Sem tradução. Usado no /start e no "voltar".
async function sendWelcome(
  token: string,
  chatId: number | string,
  welcomeMsg: WelcomeMsg,
  from: TgFrom,
  plans: PlanLite[],
): Promise<void> {
  const text = replaceVars(welcomeMsg.content, from);
  const parseMode = welcomeMsg.parseMode === "plain" ? undefined : welcomeMsg.parseMode;

  const buttons: unknown[][] = [];
  const redirects = safeJson<RedirectButton[]>(welcomeMsg.buttons, []);
  const rr = redirects.filter((b) => b.enabled !== false && b.text && b.url).map((b) => ({ text: b.text, url: b.url }));
  if (rr.length) buttons.push(rr);
  for (const p of plans) buttons.push([{ text: `${p.name} — ${planPriceBRL(p)}`, callback_data: `icebot:pay:${p.id}` }]);
  const reply_markup = buttons.length ? { inline_keyboard: buttons } : undefined;

  const fileIds = safeJson<string[]>(welcomeMsg.mediaIds, []).filter(Boolean);
  const typeByFid: Record<string, string> = {};
  if (fileIds.length) {
    const rows = await prisma.media.findMany({ where: { fileId: { in: fileIds } } });
    for (const r of rows) if (r.fileId) typeByFid[r.fileId] = r.type;
  }

  const methodFor = (t: string) =>
    t === "video" ? ["sendVideo", "video"] : t === "audio" ? ["sendAudio", "audio"] : t === "document" ? ["sendDocument", "document"] : ["sendPhoto", "photo"];

  // 1 mídia → envia com legenda + botões
  if (fileIds.length === 1) {
    const fid = fileIds[0];
    const [method, field] = methodFor(typeByFid[fid] ?? "photo");
    const base: Record<string, unknown> = { chat_id: chatId, [field]: fid, caption: text, ...(reply_markup && { reply_markup }) };
    const r = await tgPost(token, method, { ...base, ...(parseMode && { parse_mode: parseMode }) });
    if (!r.ok && parseMode) await tgPost(token, method, base);
    return;
  }

  // 2+ mídias → media group (sem botões) e depois a mensagem com botões
  if (fileIds.length > 1) {
    const group = fileIds.slice(0, 10).map((fid, i) => ({
      type: (typeByFid[fid] === "video" ? "video" : "photo") as "video" | "photo",
      media: fid,
      ...(i === 0 ? { caption: text, ...(parseMode && { parse_mode: parseMode }) } : {}),
    }));
    const r = await tgPost(token, "sendMediaGroup", { chat_id: chatId, media: group });
    if (!r.ok && parseMode) {
      await tgPost(token, "sendMediaGroup", {
        chat_id: chatId,
        media: group.map(({ type, media }, i) => (i === 0 ? { type, media, caption: text } : { type, media })),
      });
    }
    if (reply_markup) await tgPost(token, "sendMessage", { chat_id: chatId, text: "👇 Escolha seu acesso:", reply_markup });
    return;
  }

  // sem mídia → só texto
  const base: Record<string, unknown> = { chat_id: chatId, text, ...(reply_markup && { reply_markup }) };
  const r = await tgPost(token, "sendMessage", { ...base, ...(parseMode && { parse_mode: parseMode }) });
  if (!r.ok && parseMode) await tgPost(token, "sendMessage", base);
}

// ── main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const update = await req.json();
    const { botId } = await params;
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: {
        messages: { where: { trigger: "welcome" }, take: 1 },
        plans: { where: { active: true }, include: { features: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!bot) return NextResponse.json({ ok: true });

    // ── callback queries ──────────────────────────────────────────────────────
    const cbq = update.callback_query;
    if (cbq) {
      const data: string = cbq.data ?? "";
      const chatId = cbq.message?.chat?.id;
      const from = cbq.from;

      await tgPost(bot.token, "answerCallbackQuery", { callback_query_id: cbq.id });

      // Language selection (existing flow)
      if (data.startsWith("lang:")) {
        const selectedLang = data.slice(5);
        const messageId = cbq.message?.message_id;
        const welcomeMsg = bot.messages[0];

        if (welcomeMsg && chatId && messageId) {
          const translations: TranslationMap = welcomeMsg.translations
            ? JSON.parse(welcomeMsg.translations)
            : {};
          const translation = translations[selectedLang] ?? null;

          const vars = (s: string) =>
            s
              .replace(/\{nome\}/g, from.first_name ?? "User")
              .replace(/\{username\}/g, from.username ? `@${from.username}` : from.first_name ?? "");

          const finalContent = vars(translation?.content || welcomeMsg.content);
          const finalButtons: unknown[][] = translation?.buttons
            ?? (welcomeMsg.buttons ? JSON.parse(welcomeMsg.buttons) : []);
          const finalParseMode = welcomeMsg.parseMode === "plain" ? undefined : welcomeMsg.parseMode;

          await tgPost(bot.token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: finalContent,
            ...(finalParseMode && { parse_mode: finalParseMode }),
            reply_markup: { inline_keyboard: finalButtons },
          });
        }

        // Update customer language in DB
        try {
          await prisma.customer.updateMany({
            where: { telegramId: String(from.id), botId },
            data: { language: selectedLang },
          });
        } catch { /* language field not yet in schema — ignore */ }

        return NextResponse.json({ ok: true });
      }

      // ── Back to welcome (apaga o detalhe do plano e reenvia as boas-vindas) ──
      if (data === "icebot:welcome") {
        const welcomeMsg = bot.messages[0];
        const messageId = cbq.message?.message_id;
        if (!welcomeMsg || !chatId) return NextResponse.json({ ok: true });
        if (messageId) {
          await tgPost(bot.token, "deleteMessage", { chat_id: chatId, message_id: messageId }).catch(() => {});
        }
        await sendWelcome(bot.token, chatId, welcomeMsg, from, bot.plans ?? []);
        return NextResponse.json({ ok: true });
      }

      // ── Plan detail + checkout ────────────────────────────────────────────────
      if (data.startsWith("icebot:pay:")) {
        const planId = data.slice("icebot:pay:".length);
        const messageId = cbq.message?.message_id;
        const plan = (bot.plans ?? []).find((p) => p.id === planId);

        if (!plan || !chatId) return NextResponse.json({ ok: true });

        // A mensagem anterior pode ser mídia (não dá editMessageText) — apaga e reenvia
        const replaceMsg = async (text: string, keyboard: unknown[][]) => {
          if (messageId) await tgPost(bot.token, "deleteMessage", { chat_id: chatId, message_id: messageId }).catch(() => {});
          await tgPost(bot.token, "sendMessage", { chat_id: chatId, text, reply_markup: { inline_keyboard: keyboard } });
        };

        const checkoutRes = await fetch(
          `${appUrl()}/api/bots/${botId}/checkout`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId,
              telegramId: String(from.id),
              telegramChatId: String(chatId),
              language: from.language_code ?? "pt",
            }),
          }
        ).then((r) => r.json());

        if (checkoutRes.alreadySubscribed) {
          await replaceMsg("✅ Você já tem acesso ativo neste plano!", [[{ text: "← Voltar", callback_data: "icebot:welcome" }]]);
          return NextResponse.json({ ok: true });
        }
        if (!checkoutRes.url) {
          await replaceMsg("⚠️ Erro ao gerar link de pagamento. Tente novamente em breve.", [[{ text: "← Voltar", callback_data: "icebot:welcome" }]]);
          return NextResponse.json({ ok: true });
        }

        const features = (plan.features as { text: string }[]) ?? [];
        const lines: string[] = [
          `🎯 ${plan.name}`,
          plan.description ? `\n${plan.description}` : "",
          "",
          `💰 ${planPriceBRL(plan)}`,
          plan.trialDays > 0 ? `🆓 ${plan.trialDays} dias grátis` : "",
          features.length > 0 ? "\n" + features.map((f) => `✔ ${f.text}`).join("\n") : "",
          "",
          "Pagamento seguro 🔒",
        ].filter((l) => l !== "");

        await replaceMsg(lines.join("\n"), [
          [{ text: "Finalizar pagamento →", url: checkoutRes.url }],
          [{ text: "← Voltar aos planos", callback_data: "icebot:welcome" }],
        ]);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // ── my_chat_member (bot promoted to admin) ────────────────────────────────
    const mcm = update.my_chat_member;
    if (mcm) {
      const chat = mcm.chat;
      const newStatus = mcm.new_chat_member?.status;
      if (
        (chat.type === "channel" || chat.type === "supergroup" || chat.type === "group") &&
        (newStatus === "administrator" || newStatus === "creator")
      ) {
        await prisma.channel.upsert({
          where: { chatId_botId: { chatId: String(chat.id), botId } },
          update: { title: chat.title, username: chat.username ?? null, type: chat.type, botIsAdmin: true, updatedAt: new Date() },
          create: { chatId: String(chat.id), title: chat.title, username: chat.username ?? null, type: chat.type, botIsAdmin: true, botId },
        });
      }
      if (newStatus === "member" || newStatus === "left" || newStatus === "kicked") {
        await prisma.channel.updateMany({
          where: { chatId: String(chat.id), botId },
          data: { botIsAdmin: false },
        });
      }
    }

    // ── channel_post ──────────────────────────────────────────────────────────
    const channelPost = update.channel_post;
    if (channelPost) {
      const chatId = String(channelPost.chat?.id);
      // isStorage: false — uploads de mídia para o storage channel também disparam
      // channel_post; não queremos criar ChannelPost (com mediaUrl) para eles.
      const channel = await prisma.channel.findFirst({ where: { chatId, botId, isStorage: false } });
      if (channel) {
        const exists = await prisma.channelPost.findFirst({
          where: { channelId: channel.id, telegramMsgId: channelPost.message_id },
        });
        if (!exists) {
          const content = channelPost.text ?? channelPost.caption ?? "";
          let mediaType: string | null = null;
          let mediaUrl: string | null = null;
          if (channelPost.photo?.length) {
            mediaType = "photo";
            const best = (channelPost.photo as Array<{ file_id: string; width: number }>)
              .reduce((a, b) => (a.width > b.width ? a : b));
            const fileRes = await fetch(
              `https://api.telegram.org/bot${bot.token}/getFile?file_id=${best.file_id}`
            ).then((r) => r.json());
            if (fileRes.ok) mediaUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
          } else if (channelPost.video) {
            mediaType = "video";
            const fileRes = await fetch(
              `https://api.telegram.org/bot${bot.token}/getFile?file_id=${channelPost.video.file_id}`
            ).then((r) => r.json());
            if (fileRes.ok) mediaUrl = `https://api.telegram.org/file/bot${bot.token}/${fileRes.result.file_path}`;
          }
          await prisma.channelPost.create({
            data: { channelId: channel.id, telegramMsgId: channelPost.message_id, content, parseMode: "plain", status: "received", sentAt: new Date(channelPost.date * 1000), mediaType, mediaUrl, buttons: null },
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // ── private messages ──────────────────────────────────────────────────────
    const message = update.message;
    if (!message) return NextResponse.json({ ok: true });

    const from = message.from;
    if (!from || message.chat?.type !== "private") return NextResponse.json({ ok: true });

    const chatId = message.chat.id;

    if (message.text?.startsWith("/start")) {
      const welcomeMsg = bot.messages[0];
      if (!welcomeMsg) return NextResponse.json({ ok: true });

      const rawParam = message.text.split(" ")[1];
      const { langCode, source } = parseStartParam(rawParam);

      console.log(`[webhook] /start from=${from.id} username=${from.username} param=${rawParam ?? "none"}`);

      await Promise.all([
        sendWelcome(bot.token, chatId, welcomeMsg, from, bot.plans ?? []),
        prisma.customer.upsert({
          where: { telegramId_botId: { telegramId: String(from.id), botId } },
          update: {
            username: from.username,
            firstName: from.first_name,
            lastName: from.last_name,
            ...(langCode && { language: langCode }),
            ...(source && { source }),
          },
          create: {
            telegramId: String(from.id),
            username: from.username,
            firstName: from.first_name,
            lastName: from.last_name,
            language: langCode,
            source,
            botId,
          },
        }).catch((err) => {
          console.error(`[webhook] customer upsert error for ${from.id}:`, err);
        }),
      ]);

      const parseMode = welcomeMsg.parseMode === "plain" ? undefined : welcomeMsg.parseMode;
      if (welcomeMsg.secondaryEnabled && welcomeMsg.secondaryContent?.trim()) {
        const base: Record<string, unknown> = { chat_id: chatId, text: replaceVars(welcomeMsg.secondaryContent, from) };
        const r = await tgPost(bot.token, "sendMessage", { ...base, ...(parseMode && { parse_mode: parseMode }) });
        if (!r.ok && parseMode) await tgPost(bot.token, "sendMessage", base);
      }

    } else {
      // Non-/start message: upsert customer only
      const fromLang = from.language_code?.split("-")[0] ?? undefined;
      prisma.customer.upsert({
        where: { telegramId_botId: { telegramId: String(from.id), botId } },
        update: { username: from.username, firstName: from.first_name, lastName: from.last_name },
        create: { telegramId: String(from.id), username: from.username, firstName: from.first_name, lastName: from.last_name, language: fromLang, botId },
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
