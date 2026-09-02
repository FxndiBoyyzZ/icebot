import { Bot, Plus, Settings, MessageSquare, CreditCard, Users, Zap } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BotsPage() {
  const bots = await prisma.bot.findMany({
    where: { orgId: "default-org" },
    include: {
      _count: { select: { plans: true, customers: true, messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Meus Bots</h1>
          <p className="text-[#71717a] text-sm mt-0.5">Gerencie seus bots de vendas no Telegram</p>
        </div>
        <Link
          href="/bots/new"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Bot
        </Link>
      </div>

      {bots.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}

function BotCard({ bot }: {
  bot: {
    id: string;
    name: string;
    username: string | null;
    description: string | null;
    active: boolean;
    _count: { plans: number; customers: number; messages: number };
  }
}) {
  const initials = bot.name.slice(0, 2).toUpperCase();
  const colors = [
    "from-blue-500 to-blue-700",
    "from-violet-500 to-violet-700",
    "from-emerald-500 to-emerald-700",
    "from-rose-500 to-rose-700",
    "from-amber-500 to-amber-700",
  ];
  const color = colors[bot.name.charCodeAt(0) % colors.length];

  return (
    <div className="group relative bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex flex-col gap-4 hover:border-[#3f3f46] transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{bot.name}</h3>
            {bot.username
              ? <p className="text-xs text-[#71717a]">@{bot.username}</p>
              : <p className="text-xs text-[#ef4444]/80">Sem username</p>
            }
          </div>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${bot.active ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
          {bot.active ? "Ativo" : "Inativo"}
        </span>
      </div>

      {bot.description && (
        <p className="text-[13px] text-[#71717a] line-clamp-2 leading-relaxed">{bot.description}</p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-[#71717a]">
        <Stat icon={CreditCard} value={bot._count.plans} label="planos" />
        <span className="text-[#27272a]">·</span>
        <Stat icon={Users} value={bot._count.customers} label="clientes" />
        <span className="text-[#27272a]">·</span>
        <Stat icon={MessageSquare} value={bot._count.messages} label="msgs" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#27272a]">
        <Link
          href={`/bots/${bot.id}/plans`}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-[#a1a1aa] hover:text-white bg-[#27272a] hover:bg-[#3f3f46] px-3 py-2 rounded-lg transition-colors"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Planos
        </Link>
        <Link
          href={`/bots/${bot.id}/messages`}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-[#a1a1aa] hover:text-white bg-[#27272a] hover:bg-[#3f3f46] px-3 py-2 rounded-lg transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Mensagens
        </Link>
        <Link
          href={`/bots/${bot.id}/settings`}
          className="flex items-center justify-center w-8 h-8 text-[#71717a] hover:text-white bg-[#27272a] hover:bg-[#3f3f46] rounded-lg transition-colors shrink-0"
        >
          <Settings className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="w-3 h-3" />
      <span className="text-[#a1a1aa] font-medium">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
        <Zap className="w-7 h-7 text-blue-400" />
      </div>
      <h2 className="text-base font-semibold text-white mb-1.5">Nenhum bot criado</h2>
      <p className="text-[#71717a] text-sm max-w-xs mb-6 leading-relaxed">
        Crie seu primeiro bot de vendas. Você vai precisar de um token do{" "}
        <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
          @BotFather
        </a>.
      </p>
      <Link
        href="/bots/new"
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Criar primeiro bot
      </Link>
    </div>
  );
}
