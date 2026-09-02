"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  LayoutDashboard, Bot, Zap, Settings, ChevronLeft, ChevronRight, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const botId = typeof params?.botId === "string" ? params.botId : null;
  const [collapsed, setCollapsed] = React.useState(false);

  const items: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
    { label: "Bots",      href: "/bots",      icon: Bot,             exact: true },
    { label: "Clone",     href: "/clone",     icon: Copy,            exact: true },
  ];

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href || pathname.startsWith(item.href + "/");
    return pathname.startsWith(item.href);
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col bg-[#111113] border-r border-[#27272a] shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-14 border-b border-[#27272a] px-3 shrink-0",
        collapsed ? "justify-center" : "gap-2.5 px-4"
      )}>
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15 }}
                className="font-semibold text-[15px] text-white tracking-tight whitespace-nowrap"
              >
                IceBot
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-hide">
        {items.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item)} collapsed={collapsed} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#27272a] p-2 space-y-0.5">
        {botId && (
          <NavLink
            item={{ label: "Config Bot", href: `/bots/${botId}/settings`, icon: Settings }}
            active={pathname === `/bots/${botId}/settings`}
            collapsed={collapsed}
          />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#27272a] transition-colors text-sm",
            collapsed && "justify-center"
          )}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 shrink-0" />
            : <><ChevronLeft className="w-4 h-4 shrink-0" /><span>Recolher</span></>
          }
        </button>
      </div>
    </motion.aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors relative group",
        active
          ? "bg-[#1d4ed8]/20 text-blue-400"
          : "text-[#a1a1aa] hover:text-white hover:bg-[#27272a]",
        collapsed && "justify-center"
      )}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-lg bg-blue-500/10 border border-blue-500/20"
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        />
      )}
      <item.icon className="w-4 h-4 shrink-0 relative z-10" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="relative z-10 whitespace-nowrap font-medium"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-[#27272a] text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-[#3f3f46]">
          {item.label}
        </div>
      )}
    </Link>
  );
}
