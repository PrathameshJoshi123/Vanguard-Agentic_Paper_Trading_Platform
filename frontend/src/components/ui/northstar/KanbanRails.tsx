"use client";

import React from "react";
import { Flame, Sun, Snowflake, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";

export type CardTemperature = "hot" | "warm" | "cold";

export interface KanbanCardItem {
  id: string;
  title: string;
  subtitle?: string;
  value: string;
  secondaryValue?: string;
  temperature?: CardTemperature;
  timestamp?: string;
  badge?: string;
  channel?: "API" | "COPILOT" | "TERMINAL" | "MIS";
  avatars?: string[];
  onClick?: () => void;
}

export interface KanbanColumn {
  id: string;
  title: string;
  dotColor: string;
  stageTintHex: string; // e.g. "#22C55E33"
  summaryTotal?: string;
  cards: KanbanCardItem[];
}

interface KanbanRailsProps {
  columns: KanbanColumn[];
  className?: string;
}

export function KanbanRails({ columns, className = "" }: KanbanRailsProps) {
  return (
    <div
      className={`flex items-start gap-4 overflow-x-auto pb-4 slim-scrollbar ${className}`}
    >
      {columns.map((col) => {
        return (
          <div key={col.id} className="w-64 shrink-0 flex flex-col">
            {/* Stage Column Header Pill */}
            <div
              style={CONTROL_SHADOW_STYLE}
              className="rounded-t-2xl px-3.5 py-2.5 bg-white dark:bg-[#18181b] border border-slate-200/80 dark:border-white/10 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${col.dotColor}`} />
                <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                  {col.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                {col.summaryTotal && (
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">
                    {col.summaryTotal}
                  </span>
                )}
                <span className="rounded-full px-1.5 py-0.2 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300 font-bold">
                  {col.cards.length}
                </span>
              </div>
            </div>

            {/* Cards Rail Container with 20% opacity stage background tint */}
            <div
              style={{ backgroundColor: col.stageTintHex }}
              className="rounded-b-2xl p-2 border-x border-b border-slate-200 dark:border-white/[0.08] min-h-[360px] space-y-2.5 transition-colors"
            >
              {col.cards.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-[11px] text-slate-400 dark:text-zinc-500 font-mono italic">
                  No orders in stage
                </div>
              ) : (
                col.cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={card.onClick}
                    className="rounded-xl bg-white hover:bg-slate-50 dark:bg-[#17171a] dark:hover:bg-[#1a1a1d] p-2.5 text-xs shadow-xs border border-slate-200 dark:border-[#414141] cursor-grab transition-all hover:translate-y-[-1px] select-none"
                  >
                    {/* Top Row: Temperature + Lead/Symbol + Time */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {card.temperature === "hot" && (
                          <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        {card.temperature === "warm" && (
                          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        {card.temperature === "cold" && (
                          <Snowflake className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {card.title}
                        </span>
                      </div>
                      {card.timestamp && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                          {card.timestamp}
                        </span>
                      )}
                    </div>

                    {/* Subtitle / Spec */}
                    {card.subtitle && (
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 mb-2 truncate">
                        {card.subtitle}
                      </div>
                    )}

                    {/* Deal / Trade Size & Secondary Stat */}
                    <div className="flex items-baseline justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {card.value}
                      </span>
                      {card.secondaryValue && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-400">
                          {card.secondaryValue}
                        </span>
                      )}
                    </div>

                    {/* Footer Row: Channel chip & Avatars */}
                    <div className="flex items-center justify-between mt-2 pt-1">
                      {card.channel ? (
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300">
                          {card.channel}
                        </span>
                      ) : (
                        <span />
                      )}

                      {card.avatars && card.avatars.length > 0 && (
                        <div className="flex items-center -space-x-1.5">
                          {card.avatars.map((av, idx) => (
                            <div
                              key={idx}
                              className="w-4 h-4 rounded-full bg-slate-800 text-white text-[8px] font-bold flex items-center justify-center ring-1 ring-white dark:ring-zinc-900"
                            >
                              {av}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

