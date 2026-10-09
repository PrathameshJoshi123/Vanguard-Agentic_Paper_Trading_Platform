"use client";

import React from "react";
import { Search } from "lucide-react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";

export interface FilterPill {
  id: string;
  label: string;
  active: boolean;
  count?: number;
}

interface DataTableToolbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filterPills?: FilterPill[];
  onToggleFilter?: (id: string) => void;
  actions?: React.ReactNode;
}

export function DataTableToolbar({
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search records...",
  filterPills = [],
  onToggleFilter,
  actions,
}: DataTableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Filter Input with CONTROL_SHADOW_STYLE */}
        {onSearchChange && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={CONTROL_SHADOW_STYLE}
              className="h-8 w-60 rounded-full pl-8 pr-3 text-xs bg-white dark:bg-[#1c1c1f] text-slate-900 dark:text-zinc-100 border border-slate-200/80 dark:border-transparent placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-slate-400 dark:focus:border-white/30"
            />
          </div>
        )}

        {/* Quick Pill Filters */}
        {filterPills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => onToggleFilter?.(pill.id)}
            style={CONTROL_SHADOW_STYLE}
            className={`h-8 px-3 rounded-full text-xs font-medium cursor-pointer transition-all border flex items-center gap-1.5 select-none ${
              pill.active
                ? "bg-slate-900 text-white dark:bg-white dark:text-black border-transparent shadow-xs"
                : "bg-white dark:bg-[#1c1c1f] text-slate-600 dark:text-zinc-300 border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327]"
            }`}
          >
            <span>{pill.label}</span>
            {pill.count !== undefined && (
              <span
                className={`text-[10px] font-mono rounded-full px-1.5 py-0.2 ${
                  pill.active
                    ? "bg-white/20 dark:bg-black/20 text-white dark:text-black"
                    : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-zinc-400"
                }`}
              >
                {pill.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface DataTableContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function DataTableContainer({
  children,
  className = "",
}: DataTableContainerProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] shadow-xs overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-slate-50/75 dark:bg-[#1f1f23] text-slate-500 dark:text-zinc-400 text-[11px] font-semibold border-b border-slate-200/80 dark:border-white/10">
      {children}
    </thead>
  );
}

export function DataTableRow({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/70 dark:hover:bg-white/[0.03] text-xs transition-colors ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </tr>
  );
}

