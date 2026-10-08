"use client";

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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  {
    name: "Trading Terminal",
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
  {
    name: "Regulatory Ledger",
    href: "/ledger",
    icon: BookOpenCheck,
    badge: "₹0.00 Disc",
  },
  {
    name: "AI Copilot & Alerts",
    href: "/copilot",
    icon: Bot,
    badge: "Agentic",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0 sticky top-0 z-40">
      {/* Brand Header */}
      <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-sm">
            S7
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
              SYRUS-7
              <span className="text-[10px] font-mono px-1 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                LIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              NSE Paper Trading Engine
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Workspaces
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-100 text-slate-900 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-slate-900" : "text-slate-400"
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isActive
                      ? "bg-white text-slate-700 border border-slate-200"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-2 text-xs">
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-1.5 font-medium">
            <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            Deterministic Engine
          </span>
          <span className="font-mono text-[11px] text-emerald-700">&lt;5ms RAM</span>
        </div>
        <div className="flex items-center justify-between text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Audit Ledger
          </span>
          <Badge variant="outline" className="text-[10px] bg-white font-mono px-1 py-0">
            PAISE PRECISION
          </Badge>
        </div>
      </div>
    </aside>
  );
}
