import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

// Cria invite link + envia mensagens no Telegram após o pagamento
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return NextResponse.json({ received: true });

  const { botId, planId, telegramId, telegramChatId } = session.metadata ?? {};
  if (!botId || !planId || !telegramId || !telegramChatId) {
    return NextResponse.json({ received: true });
  }

  try {
    const [bot, plan, customer] = await Promise.all([
      prisma.bot.findUnique({ where: { id: botId } }),
      prisma.plan.findUnique({ where: { id: planId } }),
      prisma.customer.findFirst({ where: { telegramId, botId } }),
    ]);

    if (!bot || !plan || !customer) return NextResponse.json({ received: true });

    // Create subscription record
    const now = new Date();
    const endDate = plan.interval === "monthly"
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      : plan.interval === "yearly"
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : null;

    await prisma.subscription.create({
      data: {
        customerId: customer.id,
        planId,
        status: "active",
        startDate: now,
        endDate,
        stripeSubId: typeof session.subscription === "string" ? session.subscription : null,
      },
    });

    // Find the channel matching the customer's language
    const lang = customer.language ?? "en";
    const channels = await prisma.channel.findMany({
      where: { botId, isStorage: false, botIsAdmin: true },
    });

    const targetChannel =
      channels.find((c) => c.language === lang) ??
      channels.find((c) => c.language === "en") ??
      channels[0];

    let inviteText = "";
    if (targetChannel) {
      // Generate a one-time invite link via Bot API
      const inviteRes = await fetch(
        `https://api.telegram.org/bot${bot.token}/createChatInviteLink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetChannel.chatId,
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
          }),
        }
      ).then((r) => r.json());

      if (inviteRes.ok) {
        inviteText = `\n\n🔑 Seu link de acesso (expira em 24h):\n${inviteRes.result.invite_link}`;
      }
    }

    // Send confirmation message
    await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: `✅ *Pagamento confirmado!*\n\nObrigado por assinar o plano *${plan.name}*!${inviteText}`,
        parse_mode: "Markdown",
      }),
    });

    await prisma.payment.create({
      data: {
        customerId: customer.id,
        amount: plan.price * 100,
        currency: plan.currency,
        status: "paid",
        provider: "stripe",
        externalId: session.id,
      },
    });
  } catch (err) {
    console.error("Stripe webhook processing error:", err);
  }

  return NextResponse.json({ received: true });
}
