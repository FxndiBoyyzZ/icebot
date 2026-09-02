import { prisma } from "@/lib/prisma"
import { Activity, UserPlus, DollarSign, ReceiptText, Clock } from "lucide-react"

const ORG_ID = "default-org"

type EventType = "lead" | "checkout" | "payment"

interface BotEvent {
  id: string
  type: EventType
  title: string
  description: string
  createdAt: Date
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function formatDate(date: Date): string {
  const d = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  const t = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return `${d}, ${t}`
}

function customerName(c: { firstName?: string | null; username?: string | null }): string {
  return c.firstName?.trim() || (c.username ? `@${c.username}` : "Usuário")
}

function formatAmount(amount: number, currency: string): string {
  const locale = currency === "BRL" ? "pt-BR" : "en-US"
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount / 100)
}

const eventConfig: Record<EventType, { icon: React.ElementType; iconBg: string; iconColor: string }> = {
  lead: {
    icon: UserPlus,
    iconBg: "bg-blue-600/15",
    iconColor: "text-blue-400",
  },
  checkout: {
    icon: ReceiptText,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
  },
  payment: {
    icon: DollarSign,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
  },
}

export async function ActivityLogCard() {
  const bots = await prisma.bot.findMany({
    where: { orgId: ORG_ID },
    select: { id: true },
  })
  const botIds = bots.map((b) => b.id)

  if (botIds.length === 0) {
    return <EmptyCard />
  }

  const [customers, checkoutLinks, payments] = await Promise.all([
    prisma.customer.findMany({
      where: { botId: { in: botIds } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, firstName: true, username: true, language: true, createdAt: true },
    }),
    prisma.checkoutLink.findMany({
      where: { botId: { in: botIds } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, telegramId: true, botId: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: {
        customer: { botId: { in: botIds } },
        status: "paid",
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: {
        customer: { select: { firstName: true, username: true } },
      },
    }),
  ])

  // Resolve customer names for checkout links
  const checkoutCustomers =
    checkoutLinks.length > 0
      ? await prisma.customer.findMany({
          where: {
            OR: checkoutLinks.map((cl) => ({ telegramId: cl.telegramId, botId: cl.botId })),
          },
          select: { telegramId: true, botId: true, firstName: true, username: true },
        })
      : []

  const customerByKey = new Map(checkoutCustomers.map((c) => [`${c.telegramId}:${c.botId}`, c]))

  const events: BotEvent[] = [
    ...customers.map((c) => ({
      id: `lead:${c.id}`,
      type: "lead" as EventType,
      title: "Novo Lead",
      description: `${customerName(c)} — Iniciou conversa${c.language ? ` · ${c.language}` : ""}`,
      createdAt: c.createdAt,
    })),
    ...checkoutLinks.map((cl) => {
      const cust = customerByKey.get(`${cl.telegramId}:${cl.botId}`)
      const name = cust ? customerName(cust) : `#${cl.telegramId}`
      return {
        id: `checkout:${cl.id}`,
        type: "checkout" as EventType,
        title: "Gerar Pagamento",
        description: `${name} — Checkout iniciado`,
        createdAt: cl.createdAt,
      }
    }),
    ...payments.map((p) => ({
      id: `payment:${p.id}`,
      type: "payment" as EventType,
      title: "Pagamento Aprovado",
      description: `${customerName(p.customer)} — Pagou ${formatAmount(p.amount, p.currency)}`,
      createdAt: p.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15)

  if (events.length === 0) {
    return <EmptyCard />
  }

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center">
          <Activity className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-white leading-none">Log de Atividades</h2>
          <p className="text-[10px] font-semibold text-[#3b82f6] tracking-[0.1em] mt-1">TEMPO REAL</p>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="overflow-y-auto flex-1 px-3 pb-3 space-y-2 scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-transparent" style={{ maxHeight: 440 }}>
        {events.map((event) => {
          const cfg = eventConfig[event.type]
          const Icon = cfg.icon
          return (
            <div key={event.id} className="flex items-center gap-3 bg-[#27272a]/60 hover:bg-[#27272a] rounded-xl px-4 py-3 transition-colors">
              <div className={`w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white leading-none">{event.title}</p>
                <p className="text-[12px] text-[#71717a] mt-1 truncate">{event.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold text-white leading-none">{timeAgo(event.createdAt)}</p>
                <p className="text-[11px] text-[#52525b] mt-1 flex items-center gap-1 justify-end">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDate(event.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyCard() {
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-600/15 flex items-center justify-center">
          <Activity className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-white leading-none">Log de Atividades</h2>
          <p className="text-[10px] font-semibold text-[#3b82f6] tracking-[0.1em] mt-1">TEMPO REAL</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <Activity className="w-8 h-8 text-[#3f3f46]" />
        <p className="text-xs text-[#71717a] text-center">
          Nenhuma atividade ainda.<br />Crie seu primeiro bot para começar.
        </p>
      </div>
    </div>
  )
}
