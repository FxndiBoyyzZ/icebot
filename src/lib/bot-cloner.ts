import { TelegramClient } from "telegram";
import { Api } from "telegram";
import { getMTProtoClient } from "./telegram-mtproto";

export interface CapturedStep {
  trigger: string;
  content: string;
  parseMode: "MarkdownV2" | "HTML" | "plain";
  mediaType?: "photo" | "video" | "document" | "animation" | "sticker";
  mediaUrl?: string;
  inlineButtons?: Array<Array<{ text: string; data?: string; url?: string }>>;
  replyButtons?: Array<Array<string>>;
}

// ── Analysis types ──────────────────────────────────────────────────────────

export interface DetectedPlan {
  buttonText: string;
  price: string | null;
  currency: string | null;
  interval: "monthly" | "yearly" | "lifetime" | null;
  responseContent: string;
  responseMediaType?: string;
  responseMediaUrl?: string;
  checkoutUrl?: string;
}

export interface DetectedOrderBump {
  trigger: string;
  content: string;
  mediaType?: string;
  mediaUrl?: string;
  buttons: Array<{ text: string; url?: string }>;
}

export interface BotAnalysis {
  welcomeMessage: {
    content: string;
    parseMode: string;
    mediaType?: string;
    mediaUrl?: string;
    inlineButtons?: Array<Array<{ text: string; data?: string; url?: string }>>;
    replyButtons?: Array<Array<string>>;
  } | null;
  plans: DetectedPlan[];
  orderBumps: DetectedOrderBump[];
  otherFlows: { trigger: string; content: string; mediaType?: string; mediaUrl?: string }[];
  rawSteps: CapturedStep[];
}

// ── Price / interval detection ───────────────────────────────────────────────

const PRICE_RE = /(?:R\$|US?\$|\$|€|£|¥|₹|₺|zł)\s*[\d.,]+|[\d.,]+\s*(?:R\$|US?\$|\$|€|£|¥|₹|₺|zł)/i;
const CURRENCY_MAP: Record<string, string> = {
  "R$": "BRL", "$": "USD", "US$": "USD", "€": "EUR", "£": "GBP",
  "¥": "JPY", "₹": "INR", "₺": "TRY", "zł": "PLN",
};
const MONTHLY_RE = /m[eê]s|mensal|month|monthly/i;
const YEARLY_RE = /an[ou]|anual|year|yearly/i;
const LIFETIME_RE = /vitalí?ci[oa]|lifetime|único|unico|one.?time/i;
const PLAN_SIGNAL_RE = /assinar|comprar|pagar|plano|plan|acessar|acesso|checkout|adquirir/i;
const ORDERBUMP_RE = /adicionar|aproveitar|bundle|oferta|upgrade|turbinar|bônus|bonus/i;

function extractPrice(text: string): { price: string | null; currency: string | null } {
  const m = text.match(PRICE_RE);
  if (!m) return { price: null, currency: null };
  const raw = m[0];
  for (const [sym, cur] of Object.entries(CURRENCY_MAP)) {
    if (raw.includes(sym)) return { price: raw, currency: cur };
  }
  return { price: raw, currency: null };
}

function extractInterval(text: string): DetectedPlan["interval"] {
  if (LIFETIME_RE.test(text)) return "lifetime";
  if (YEARLY_RE.test(text)) return "yearly";
  if (MONTHLY_RE.test(text)) return "monthly";
  return null;
}

function isPlanButton(btnText: string, responseContent: string): boolean {
  return (
    PRICE_RE.test(btnText) ||
    PLAN_SIGNAL_RE.test(btnText) ||
    PRICE_RE.test(responseContent) ||
    PLAN_SIGNAL_RE.test(responseContent)
  );
}

function isOrderBump(trigger: string, content: string): boolean {
  return ORDERBUMP_RE.test(trigger) || ORDERBUMP_RE.test(content);
}

function checkoutUrlFromStep(step: CapturedStep): string | undefined {
  const allText = [step.content, ...(step.inlineButtons?.flat().map((b) => b.url) ?? [])].join(" ");
  const m = allText.match(/https?:\/\/[^\s<>"]+(?:stripe|checkout|pay|pagamento)[^\s<>"]+/i);
  return m?.[0];
}

// ── Analysis ─────────────────────────────────────────────────────────────────

export function analyzeBotSteps(steps: CapturedStep[]): BotAnalysis {
  const welcomeStep = steps.find((s) => s.trigger === "/start");
  const nonStart = steps.filter((s) => s.trigger !== "/start");

  const plans: DetectedPlan[] = [];
  const orderBumps: DetectedOrderBump[] = [];
  const otherFlows: BotAnalysis["otherFlows"] = [];

  // Collect buttons from the welcome message to classify what each triggers
  const welcomeInlineButtons = welcomeStep?.inlineButtons?.flat() ?? [];

  for (const step of nonStart) {
    const { price, currency } = extractPrice(step.content + " " + step.trigger);
    const interval = extractInterval(step.content + " " + step.trigger);
    const checkoutUrl = checkoutUrlFromStep(step);

    if (isOrderBump(step.trigger, step.content)) {
      orderBumps.push({
        trigger: step.trigger,
        content: step.content,
        mediaType: step.mediaType,
        mediaUrl: step.mediaUrl,
        buttons: step.inlineButtons?.flat() ?? [],
      });
    } else if (isPlanButton(step.trigger, step.content)) {
      // Find the button text in welcome that triggered this
      const triggerBtn = welcomeInlineButtons.find((b) => b.text === step.trigger);
      const { price: btnPrice, currency: btnCurrency } = extractPrice(step.trigger);

      plans.push({
        buttonText: step.trigger,
        price: btnPrice ?? price,
        currency: btnCurrency ?? currency,
        interval: interval ?? extractInterval(step.trigger),
        responseContent: step.content,
        responseMediaType: step.mediaType,
        responseMediaUrl: step.mediaUrl,
        checkoutUrl: checkoutUrl ?? triggerBtn?.url,
      });
    } else if (step.content || step.mediaType) {
      otherFlows.push({
        trigger: step.trigger,
        content: step.content,
        mediaType: step.mediaType,
        mediaUrl: step.mediaUrl,
      });
    }
  }

  // If no plan was detected from button navigation, try to detect from welcome buttons
  if (plans.length === 0 && welcomeStep?.inlineButtons) {
    for (const row of welcomeStep.inlineButtons) {
      for (const btn of row) {
        const { price, currency } = extractPrice(btn.text);
        const interval = extractInterval(btn.text);
        if (price || PLAN_SIGNAL_RE.test(btn.text)) {
          plans.push({
            buttonText: btn.text,
            price,
            currency,
            interval,
            responseContent: "",
            checkoutUrl: btn.url,
          });
        }
      }
    }
  }

  return {
    welcomeMessage: welcomeStep
      ? {
          content: welcomeStep.content,
          parseMode: welcomeStep.parseMode,
          mediaType: welcomeStep.mediaType,
          mediaUrl: welcomeStep.mediaUrl,
          inlineButtons: welcomeStep.inlineButtons,
          replyButtons: welcomeStep.replyButtons,
        }
      : null,
    plans,
    orderBumps,
    otherFlows,
    rawSteps: steps,
  };
}

// ── MTProto scraping ──────────────────────────────────────────────────────────

// Nota: o clone captura apenas a *estrutura* do bot (textos, botões, planos e o
// tipo de mídia de cada passo). Os arquivos de mídia em si NÃO são baixados nem
// armazenados — nenhuma imagem de bot de terceiros entra na nossa infra. A mídia
// real é adicionada depois pelo usuário via biblioteca de Mídias, que sobe para
// o storage channel do Telegram (ver src/lib/storage-channel.ts).

function extractButtons(message: Api.Message): {
  inline?: Array<Array<{ text: string; data?: string; url?: string }>>;
  reply?: Array<Array<string>>;
} {
  const result: ReturnType<typeof extractButtons> = {};

  if (message.replyMarkup instanceof Api.ReplyInlineMarkup) {
    result.inline = message.replyMarkup.rows.map((row) =>
      row.buttons.map((btn) => {
        if (btn instanceof Api.KeyboardButtonCallback)
          return { text: btn.text, data: Buffer.from(btn.data).toString("utf8") };
        if (btn instanceof Api.KeyboardButtonUrl)
          return { text: btn.text, url: btn.url };
        return { text: btn.text };
      })
    );
  }

  if (message.replyMarkup instanceof Api.ReplyKeyboardMarkup) {
    result.reply = message.replyMarkup.rows.map((row) => row.buttons.map((btn) => btn.text));
  }

  return result;
}

function detectParseMode(text: string): CapturedStep["parseMode"] {
  if (/<[a-z][\s\S]*>/i.test(text)) return "HTML";
  if (/[*_`[\]~|]/.test(text)) return "MarkdownV2";
  return "plain";
}

async function pollMessages(
  client: TelegramClient,
  peer: string,
  afterDate: number,
  timeoutMs = 7000,
): Promise<Api.Message[]> {
  const deadline = Date.now() + timeoutMs;
  const seen = new Set<number>();
  const collected: Api.Message[] = [];

  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 600));
    const msgs = await client.getMessages(peer, { limit: 10 });
    for (const msg of msgs) {
      if (msg.out || msg.date < afterDate || seen.has(msg.id)) continue;
      seen.add(msg.id);
      collected.push(msg);
    }
    if (collected.length > 0 && Date.now() > deadline - 1200) break;
  }

  return collected.sort((a, b) => a.date - b.date);
}

export async function cloneBot(username: string): Promise<CapturedStep[]> {
  const client = await getMTProtoClient();
  const peer = username.startsWith("@") ? username.slice(1) : username;
  const steps: CapturedStep[] = [];

  const startedAt = Math.floor(Date.now() / 1000) - 1;
  await client.sendMessage(peer, { message: "/start" });
  const startMsgs = await pollMessages(client, peer, startedAt);

  for (const msg of startMsgs) {
    const { inline, reply } = extractButtons(msg);
    const text = msg.message ?? "";
    const mediaType: CapturedStep["mediaType"] = msg.photo ? "photo" : msg.document ? "document" : msg.video ? "video" : undefined;

    steps.push({
      trigger: "/start",
      content: text,
      parseMode: detectParseMode(text),
      ...(mediaType ? { mediaType } : {}),
      ...(inline ? { inlineButtons: inline } : {}),
      ...(reply ? { replyButtons: reply } : {}),
    });
  }

  // Click inline buttons (max 8)
  const firstMsg = startMsgs.find((m) => m.replyMarkup instanceof Api.ReplyInlineMarkup);
  if (firstMsg && firstMsg.replyMarkup instanceof Api.ReplyInlineMarkup) {
    const callbackButtons = firstMsg.replyMarkup.rows
      .flatMap((r) => r.buttons)
      .filter((b): b is Api.KeyboardButtonCallback => b instanceof Api.KeyboardButtonCallback)
      .slice(0, 8);

    for (const btn of callbackButtons) {
      try {
        const clickedAt = Math.floor(Date.now() / 1000) - 1;
        await client.invoke(
          new Api.messages.GetBotCallbackAnswer({
            peer: await client.getInputEntity(peer),
            msgId: firstMsg.id,
            data: btn.data,
          })
        );
        const btnMsgs = await pollMessages(client, peer, clickedAt, 4000);
        for (const msg of btnMsgs) {
          const { inline, reply } = extractButtons(msg);
          const text = msg.message ?? "";
          const mediaType: CapturedStep["mediaType"] = msg.photo ? "photo" : msg.document ? "document" : msg.video ? "video" : undefined;

          steps.push({
            trigger: btn.text,
            content: text,
            parseMode: detectParseMode(text),
            ...(mediaType ? { mediaType } : {}),
            ...(inline ? { inlineButtons: inline } : {}),
            ...(reply ? { replyButtons: reply } : {}),
          });
        }
      } catch {
        // skip unresponsive buttons
      }
    }
  }

  return steps;
}
