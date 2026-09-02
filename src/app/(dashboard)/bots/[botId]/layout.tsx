"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Bot, MessageSquare, CreditCard, TrendingUp, TrendingDown,
  ShoppingCart, Package, DollarSign, RefreshCw, Trophy,
  BarChart2, LayoutGrid, Users, Link2, Image as ImageIcon, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const TABS = [
  { label: "Bot",           slug: "settings",       icon: Bot },
  { label: "Boas-vindas",  slug: "messages",       icon: MessageSquare },
  { label: "Mídias",       slug: "media",          icon: ImageIcon },
  { label: "Planos",       slug: "plans",          icon: CreditCard },
  { label: "Upsell",       slug: "upsell",         icon: TrendingUp },
  { label: "Downsell",     slug: "downsell",       icon: TrendingDown },
  { label: "Order Bump",   slug: "order-bump",     icon: ShoppingCart },
  { label: "Packs",        slug: "packs",          icon: Package },
  { label: "Pagamentos",   slug: "payments",       icon: DollarSign },
  { label: "Assinatura",   slug: "subscription",   icon: RefreshCw },
  { label: "Clientes",     slug: "customers",      icon: Users },
  { label: "Canais",       slug: "channels",       icon: Radio },
  { label: "Links",        slug: "links",          icon: Link2 },
  { label: "Top",          slug: "top-subscribers",icon: Trophy },
  { label: "Conversões",   slug: "conversions",    icon: BarChart2 },
  { label: "Botões",       slug: "buttons",        icon: LayoutGrid },
] as const;

export default function BotLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const botId = typeof params?.botId === "string" ? params.botId : "";

  return (
    <div className="flex flex-col min-h-full">
      {/* Tab bar */}
      <div className="sticky top-0 z-20 bg-[#111113] border-b border-[#27272a]">
        <nav className="flex overflow-x-auto scrollbar-hide px-4 gap-0.5">
          {TABS.map(({ label, slug, icon: Icon }) => {
            const href = `/bots/${botId}/${slug}`;
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={slug}
                href={href}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors",
                  active ? "text-white" : "text-[#71717a] hover:text-[#a1a1aa]"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
                {active && (
                  <motion.div
                    layoutId="bot-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-t-full"
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1">{children}</div>
    </div>
  );
}
