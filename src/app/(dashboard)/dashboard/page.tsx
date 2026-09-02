import { Bot, Users, CreditCard, TrendingUp, ArrowRight, Globe } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ActivityLogCard } from "@/components/dashboard/ActivityLogCard";
import { LANG_NAMES } from "@/lib/translate";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [botCount, customerCount, subCount, langBreakdown] = await Promise.all([
    prisma.bot.count({ where: { orgId: "default-org", active: true } }),
    prisma.customer.count({ where: { bot: { orgId: "default-org" } } }),
    prisma.subscription.count({ where: { status: { in: ["active", "trialing"] } } }),
    prisma.customer.groupBy({
      by: ["language"],
      where: { bot: { orgId: "default-org" }, language: { not: null } },
      _count: { language: true },
      orderBy: { _count: { language: "desc" } },
    }),
  ]);

  const stats = [
    { label: "Bots ativos",     value: String(botCount),    icon: Bot,         color: "text-blue-400",    bg: "bg-blue-500/10"   },
    { label: "Clientes",        value: String(customerCount),icon: Users,       color: "text-emerald-400", bg: "bg-emerald-500/10"},
    { label: "Assinaturas",     value: String(subCount),    icon: CreditCard,  color: "text-violet-400",  bg: "bg-violet-500/10" },
    { label: "Receita",         value: "R$ 0",              icon: TrendingUp,  color: "text-amber-400",   bg: "bg-amber-500/10"  },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white tracking-tight">Dashboard</h1>
        <p className="text-[#71717a] text-sm mt-0.5">Visão geral dos seus bots de vendas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[#71717a] font-medium">{s.label}</span>
              <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Quickstart */}
        <div className="lg:col-span-3 bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Começar agora</h2>
          <div className="space-y-1">
            {[
              { n: 1, title: "Crie seu primeiro bot",       desc: "Adicione o token do @BotFather",         href: "/bots/new" },
              { n: 2, title: "Configure os planos",         desc: "Defina preços em USD, EUR, JPY e mais",   href: "/bots" },
              { n: 3, title: "Personalize a mensagem",      desc: "Auto-tradução em 20+ idiomas",            href: "/bots" },
              { n: 4, title: "Gere links de rastreamento",  desc: "Saiba de onde vêm seus clientes",         href: "/bots" },
            ].map(({ n, title, desc, href }) => (
              <Link key={n} href={href} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#27272a] transition-colors group">
                <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {n}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{title}</div>
                  <div className="text-xs text-[#71717a] mt-0.5">{desc}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#3f3f46] group-hover:text-blue-400 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Language breakdown */}
          {langBreakdown.length > 0 && (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-3.5 h-3.5 text-[#71717a]" />
                <h2 className="text-sm font-semibold text-white">Idiomas</h2>
              </div>
              <div className="space-y-2">
                {langBreakdown.map((l) => {
                  const pct = customerCount > 0 ? Math.round((l._count.language / customerCount) * 100) : 0;
                  const name = LANG_NAMES[l.language!] ?? l.language!;
                  return (
                    <div key={l.language} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300">{name} <span className="text-zinc-600 font-mono ml-1">{l.language}</span></span>
                        <span className="text-zinc-500">{l._count.language} <span className="text-zinc-700">({pct}%)</span></span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity log */}
          <ActivityLogCard />
        </div>
      </div>
    </div>
  );
}
