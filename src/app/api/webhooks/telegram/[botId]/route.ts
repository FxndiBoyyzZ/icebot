import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLanguage } from "@/data/languages";
import { displayPrice, LANG_PRICING } from "@/lib/pricing";
import { getOrTranslate, translateOne, LANG_NAMES } from "@/lib/translate";

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

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(price);
}

function intervalLabel(interval: string) {
  return interval === "monthly" ? "/mês" : interval === "yearly" ? "/ano" : "";
}

// Translates secondaryContent using the same translations JSON field,
// keyed as "2:<lang>" to avoid colliding with primary translations.
async function translateSecondary(
  content: string,
  targetLang: string,
  messageId: string,
  existing: TranslationMap,
): Promise<string> {
  if (targetLang === "en" || !content?.trim()) return content;
  const cacheKey = `2:${targetLang}`;
  const cached = existing[cacheKey];
  if (cached?.content) return cached.content;
  try {
    const translated = await translateOne(content, targetLang);
    const updated = { ...existing, [cacheKey]: { content: translated, auto: true, updatedAt: new Date().toISOString() } };
    await prisma.message.update({ where: { id: messageId }, data: { translations: JSON.stringify(updated) } });
    return translated;
  } catch {
    return content;
  }
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

      // ── Back to welcome (restore original message) ───────────────────────────
      if (data === "icebot:welcome") {
        const welcomeMsg = bot.messages[0];
        const messageId = cbq.message?.message_id;
        if (!welcomeMsg || !chatId || !messageId) return NextResponse.json({ ok: true });

        const lang = from.language_code?.split("-")[0] ?? "en";
        const translations: TranslationMap = welcomeMsg.translations ? JSON.parse(welcomeMsg.translations) : {};
        const vars = (s: string) =>
          s.replace(/\{nome\}/g, from.first_name ?? "User")
           .replace(/\{username\}/g, from.username ? `@${from.username}` : from.first_name ?? "");
        const translatedBack = await getOrTranslate(welcomeMsg.content, lang, welcomeMsg.id, translations);
        const content = vars(translatedBack);
        const finalParseMode = welcomeMsg.parseMode === "plain" ? undefined : welcomeMsg.parseMode;

        const planButtons: unknown[][] = (bot.plans ?? []).map((p) => {
          const isBR = lang === "pt";
          const priceText = isBR && p.priceBRL != null
            ? `R$${(p.priceBRL / 100).toFixed(2).replace(".", ",")} BRL`
            : displayPrice(p.price, lang);
          return [{ text: `${p.name} — ${priceText}`, callback_data: `icebot:pay:${p.id}` }];
        });

        await tgPost(bot.token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: content,
          ...(finalParseMode && { parse_mode: finalParseMode }),
          ...(planButtons.length > 0 && { reply_markup: { inline_keyboard: planButtons } }),
        });
        return NextResponse.json({ ok: true });
      }

      // ── Plan detail + checkout ────────────────────────────────────────────────
      if (data.startsWith("icebot:pay:")) {
        const planId = data.slice("icebot:pay:".length);
        const messageId = cbq.message?.message_id;
        const lang = from.language_code?.split("-")[0] ?? "en";
        const plan = (bot.plans ?? []).find((p) => p.id === planId);

        if (!plan || !chatId || !messageId) return NextResponse.json({ ok: true });

        const checkoutRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/bots/${botId}/checkout`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId,
              telegramId: String(from.id),
              telegramChatId: String(chatId),
              language: from.language_code ?? "en",
            }),
          }
        ).then((r) => r.json());

        if (checkoutRes.alreadySubscribed) {
          await tgPost(bot.token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: "✅ Você já tem acesso ativo neste plano!",
            reply_markup: { inline_keyboard: [[{ text: "← Voltar", callback_data: "icebot:welcome" }]] },
          });
          return NextResponse.json({ ok: true });
        }

        if (!checkoutRes.url) {
          await tgPost(bot.token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: "⚠️ Erro ao gerar link de pagamento. Tente novamente em breve.",
            reply_markup: { inline_keyboard: [[{ text: "← Voltar", callback_data: "icebot:welcome" }]] },
          });
          return NextResponse.json({ ok: true });
        }

        // Build plan summary (plain text — safe for any content)
        const price = displayPrice(plan.price, lang);
        const features = (plan.features as { text: string }[]) ?? [];
        const lines: string[] = [
          `🎯 ${plan.name}`,
          plan.description ? `\n${plan.description}` : "",
          "",
          `💰 ${price}`,
          plan.trialDays > 0 ? `🆓 ${plan.trialDays} dias grátis` : "",
          features.length > 0 ? "\n" + features.map((f) => `✔ ${f.text}`).join("\n") : "",
          "",
          "Pagamento 100% seguro via Stripe 🔒",
        ].filter((l) => l !== "");

        await tgPost(bot.token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: lines.join("\n"),
          reply_markup: {
            inline_keyboard: [
              [{ text: "Finalizar pagamento →", url: checkoutRes.url }],
              [{ text: "← Voltar aos planos", callback_data: "icebot:welcome" }],
            ],
          },
        });

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
      const { langCode: paramLang, source } = parseStartParam(rawParam);
      const langCode = paramLang ?? (from.language_code ? from.language_code.split("-")[0] : null);

      console.log(`[webhook] /start from=${from.id} username=${from.username} tg_language_code=${from.language_code ?? "null"} resolved_lang=${langCode ?? "null"} param=${rawParam ?? "none"}`);
      const effectiveLang = langCode ?? "en";
      const translations: TranslationMap = welcomeMsg.translations
        ? JSON.parse(welcomeMsg.translations)
        : {};

      const vars = (s: string) =>
        s
          .replace(/\{nome\}/g, from.first_name ?? "User")
          .replace(/\{username\}/g, from.username ? `@${from.username}` : from.first_name ?? "");

      const translatedContent = await getOrTranslate(
        welcomeMsg.content,
        effectiveLang,
        welcomeMsg.id,
        translations,
      );
      const finalContent = vars(translatedContent);
      const finalParseMode = welcomeMsg.parseMode === "plain" ? undefined : welcomeMsg.parseMode;

      const redirectButtons: RedirectButton[] = welcomeMsg.buttons
        ? JSON.parse(welcomeMsg.buttons)
        : [];
      const urlButtonRow = redirectButtons
        .filter((b) => b.enabled !== false && b.text && b.url)
        .map((b) => ({ text: b.text, url: b.url }));

      const manualTranslation = translations[effectiveLang] ?? null;
      const allButtons: unknown[][] = [...(manualTranslation?.buttons ?? [])];
      if (urlButtonRow.length > 0) allButtons.push(urlButtonRow);

      // Add one button per plan directly in the welcome message
      if (bot.plans && bot.plans.length > 0) {
        for (const p of bot.plans) {
          const isBR = effectiveLang === "pt";
          const priceText = isBR && p.priceBRL != null
            ? `R$${(p.priceBRL / 100).toFixed(2).replace(".", ",")} BRL`
            : displayPrice(p.price, effectiveLang);
          allButtons.push([{
            text: `${p.name} — ${priceText}`,
            callback_data: `icebot:pay:${p.id}`,
          }]);
        }
      }
      if (!langCode) {
        const flagButtons = Object.entries(translations)
          .filter(([, t]) => t.content)
          .map(([code]) => {
            const lang = getLanguage(code);
            return { text: lang?.flag ?? code.toUpperCase(), callback_data: `lang:${code}` };
          });
        if (flagButtons.length > 0) allButtons.push(flagButtons);
      }

      // Send welcome message + upsert customer in parallel
      const [sendResult] = await Promise.all([
        tgPost(bot.token, "sendMessage", {
          chat_id: chatId,
          text: finalContent,
          ...(finalParseMode && { parse_mode: finalParseMode }),
          ...(allButtons.length > 0 && { reply_markup: { inline_keyboard: allButtons } }),
        }),
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
          return prisma.customer.upsert({
            where: { telegramId_botId: { telegramId: String(from.id), botId } },
            update: {
              username: from.username,
              firstName: from.first_name,
              lastName: from.last_name,
              ...(langCode && { language: langCode }),
              ...(source && { source }),
            },
            create: { telegramId: String(from.id), username: from.username, firstName: from.first_name, lastName: from.last_name, language: langCode, source, botId },
          });
        }),
      ]);

      // Fallback: if parse_mode caused error, resend as plain text
      if (!sendResult.ok && finalParseMode) {
        await tgPost(bot.token, "sendMessage", {
          chat_id: chatId,
          text: finalContent,
          ...(allButtons.length > 0 && { reply_markup: { inline_keyboard: allButtons } }),
        });
      }

      if (welcomeMsg.secondaryEnabled && welcomeMsg.secondaryContent?.trim()) {
        const secondaryTranslated = await translateSecondary(
          welcomeMsg.secondaryContent,
          effectiveLang,
          welcomeMsg.id,
          welcomeMsg.translations ? JSON.parse(welcomeMsg.translations) as TranslationMap : {},
        );
        await tgPost(bot.token, "sendMessage", {
          chat_id: chatId,
          text: vars(secondaryTranslated),
          ...(finalParseMode && { parse_mode: finalParseMode }),
        });
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
