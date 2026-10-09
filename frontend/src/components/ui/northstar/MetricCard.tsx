"use client";

import React from "react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";

interface MetricCardProps {
  title: string;
  badge?: string;
  badgeColor?: string;
  value: string | number;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNegative?: boolean;
  };
  children?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  badge,
  badgeColor,
  value,
  hint,
  icon,
  trend,
  children,
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-white/20 ${className}`}
    >
      {/* Top Row: Title + Currency/Badge with CONTROL_SHADOW_STYLE */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400 dark:text-zinc-400">{icon}</span>}
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            {title}
          </span>
        </div>
        {badge && (
          <span
            style={CONTROL_SHADOW_STYLE}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] ${
              badgeColor || "text-slate-700 dark:text-zinc-300"
            }`}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Main Stat & Trend */}
      <div className="flex items-baseline justify-between mt-2">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
          {value}
        </div>
        {trend && (
          <span
            className={`text-xs font-semibold font-mono ${
              trend.isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : trend.isNegative
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-500 dark:text-zinc-400"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {/* Optional Mini Chart or custom children */}
      {children}

      {/* Hint Footnote */}
      {hint && (
        <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1.5 flex items-center gap-1.5">
          {hint}
        </div>
      )}
    </div>
  );
}

