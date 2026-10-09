"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  Briefcase,
  ListOrdered,
  BookOpenCheck,
  Bot,
  Activity,
  ShieldCheck,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { SELECTED_NAV_STYLE, CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { useTheme } from "@/components/providers/ThemeProvider";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: "Trading Terminal",
    items: [
      {
        name: "Execution Terminal",
        href: "/",
        icon: TrendingUp,
        badge: "L2 Depth",
      },
      {
        name: "Portfolio & Risk",
        href: "/portfolio",
        icon: Briefcase,
      },
      {
        name: "Orders & Fills",
        href: "/orders",
        icon: ListOrdered,
      },
    ],
  },
  {
    groupTitle: "Compliance & AI",
    items: [
      {
        name: "Regulatory Ledger",
        href: "/ledger",
        icon: BookOpenCheck,
        badge: "₹0.00 Disc",
      },
      {
        name: "AI Copilot & Risk",
        href: "/copilot",
        icon: Bot,
        badge: "Agentic",
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200/60 dark:border-zinc-800/80 bg-white dark:bg-[#121215] px-3 py-3.5 flex flex-col justify-between h-screen select-none z-40">
      {/* Top Section */}
      <div className="space-y-4">
        {/* Workspace Brand Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* 4-pointed Star Logo Mark */}
            <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate flex items-center gap-1.5">
                SYRUS-7
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                Paper Trading Engine
              </div>
            </div>
          </div>

          {/* Circular Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            style={CONTROL_SHADOW_STYLE}
            className="w-7 h-7 rounded-full border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-all shrink-0"
          >
            {theme === "dark" ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-600" />
            )}
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                {group.groupTitle}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={isActive ? SELECTED_NAV_STYLE : undefined}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "text-slate-900 dark:text-white font-semibold"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-400 dark:text-zinc-500"
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.badge && (
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium border bg-slate-100 dark:bg-[#1e1e22] dark:border-white/5 text-slate-600 dark:text-zinc-300 font-mono shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer System Status Metrics */}
      <div className="pt-3 border-t border-slate-200/60 dark:border-zinc-800/80 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
            Matching Engine
          </span>
          <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            &lt;5ms RAM
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-500 dark:text-zinc-500">
          <span className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3 h-3 text-indigo-500" />
            Double-Entry
          </span>
          <span className="rounded-full px-1.5 py-0.2 text-[9px] font-mono bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">
            PAISE PRECISION
          </span>
        </div>
      </div>
    </aside>
  );
}
