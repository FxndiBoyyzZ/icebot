import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { appUrl as getAppUrl } from "@/lib/utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" });

const INTERVAL_MAP: Record<string, Stripe.PriceCreateParams.Recurring.Interval> = {
  monthly: "month",
  yearly: "year",
};


export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const { planId, telegramId, telegramChatId } = await req.json();

    const [plan, bot] = await Promise.all([
      prisma.plan.findUnique({ where: { id: planId } }),
      prisma.bot.findUnique({ where: { id: botId } }),
    ]);

    if (!plan || !bot) {
      return NextResponse.json({ error: "Plano ou bot não encontrado" }, { status: 404 });
    }

    // 1. Check if user already has an active subscription for this plan
    const customer = await prisma.customer.findUnique({
      where: { telegramId_botId: { telegramId: String(telegramId), botId } },
    });
    if (customer) {
      const activeSub = await prisma.subscription.findFirst({
        where: {
          customerId: customer.id,
          planId,
          status: { in: ["active", "trialing"] },
        },
      });
      if (activeSub) {
        return NextResponse.json({ alreadySubscribed: true });
      }
    }

    // 2. Check for an existing valid (non-expired) checkout session for this user+plan
    const existing = await prisma.checkoutLink.findUnique({
      where: { telegramId_planId_botId: { telegramId: String(telegramId), planId, botId } },
    });
    if (existing && existing.expiresAt > new Date()) {
      // Verify session is still open in Stripe (not already paid/expired)
      try {
        const session = await stripe.checkout.sessions.retrieve(existing.sessionId);
        if (session.status === "open") {
          return NextResponse.json({ url: existing.url });
        }
      } catch { /* session not found — create new */ }
    }

    // 3. Create a new Stripe Checkout session
    const appUrl = getAppUrl();
    if (!appUrl) return NextResponse.json({ error: "APP_URL não configurada" }, { status: 500 });

    const isRecurring = plan.interval === "monthly" || plan.interval === "yearly";
    // Setup BR: preço direto em BRL, sem conversão. priceBRL tem prioridade.
    const currency = "brl";
    const amountBRL = plan.priceBRL ?? plan.price;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: isRecurring ? "subscription" : "payment",
      payment_method_types: ["card"],
      currency,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: plan.name, description: plan.description ?? undefined },
            unit_amount: amountBRL,
            ...(isRecurring && {
              recurring: { interval: INTERVAL_MAP[plan.interval] ?? "month" },
            }),
          },
          quantity: 1,
        },
      ],
      metadata: { botId, planId, telegramId: String(telegramId), telegramChatId: String(telegramChatId) },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout/cancel`,
      expires_at: Math.floor(Date.now() / 1000) + 86400, // 24h
    };

    if (plan.trialDays > 0 && isRecurring) {
      (sessionParams as Record<string, unknown>).subscription_data = {
        trial_period_days: plan.trialDays,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // 4. Cache the session
    await prisma.checkoutLink.upsert({
      where: { telegramId_planId_botId: { telegramId: String(telegramId), planId, botId } },
      update: { sessionId: session.id, url: session.url!, expiresAt: new Date(Date.now() + 23 * 3_600_000) },
      create: {
        telegramId: String(telegramId), planId, botId,
        sessionId: session.id, url: session.url!,
        expiresAt: new Date(Date.now() + 23 * 3_600_000),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar sessão" },
      { status: 500 }
    );
  }
}
