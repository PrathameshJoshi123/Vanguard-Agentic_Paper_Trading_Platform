"use client";

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  badge?: string;
  icon?: React.ReactNode;
}

interface NorthstarTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function NorthstarTabs({
  tabs,
  activeTab,
  onChange,
  className = "",
}: NorthstarTabsProps) {
  return (
    <div
      className={`flex items-center gap-6 border-b border-slate-200/80 dark:border-white/10 pb-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative pb-2 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2 select-none ${
              isActive
                ? "text-slate-900 dark:text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900 dark:after:bg-white"
                : "text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  isActive
                    ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white"
                    : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-zinc-500"
                }`}
              >
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

