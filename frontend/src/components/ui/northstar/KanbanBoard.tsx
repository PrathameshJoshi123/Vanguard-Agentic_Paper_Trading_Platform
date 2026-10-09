"use client";

import React from "react";
import {
  Flame,
  Sun,
  Snowflake,
  Phone,
  Mail,
  Video,
  MessageSquare,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CardTemperature = "hot" | "warm" | "cold";
export type FollowUpChannel = "WhatsApp" | "Meet" | "Phone" | "Mail";

export interface KanbanDealCard {
  id: string;
  leadName: string;
  jobTitle: string;
  relativeDate: string;
  dealSize: string; // e.g. "₹4,50,000"
  temperature: CardTemperature;
  avatars: string[]; // names or initials
  slaFollowUp: {
    time: string;
    channel: FollowUpChannel;
  };
  tags?: string[];
}

export interface KanbanStage {
  id: string;
  title: string;
  color: string; // e.g. "#22C55E", "#00B2FF", "#FF00DD", "#8B5CF6", "#64748B"
  tintColor: string; // e.g. "#22C55E33"
  cards: KanbanDealCard[];
}

interface KanbanBoardProps {
  stages: KanbanStage[];
  onCardClick?: (card: KanbanDealCard, stage: KanbanStage) => void;
  className?: string;
}

export function KanbanBoard({ stages, onCardClick, className }: KanbanBoardProps) {
  const renderTemperatureIcon = (temp: CardTemperature) => {
    switch (temp) {
      case "hot":
        return <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />;
      case "warm":
        return <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />;
      case "cold":
        return <Snowflake className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  const renderChannelIcon = (ch: FollowUpChannel) => {
    switch (ch) {
      case "WhatsApp":
        return <MessageSquare className="w-3 h-3 text-emerald-500" />;
      case "Meet":
        return <Video className="w-3 h-3 text-blue-500" />;
      case "Phone":
        return <Phone className="w-3 h-3 text-violet-500" />;
      case "Mail":
        return <Mail className="w-3 h-3 text-amber-500" />;
    }
  };

  return (
    <div
      className={cn(
        "flex gap-4 overflow-x-auto pb-4 pt-1 slim-scrollbar items-start select-none",
        className
      )}
    >
      {stages.map((stage) => {
        const count = stage.cards.length;

        return (
          <div key={stage.id} className="w-64 shrink-0 flex flex-col">
            {/* Header Pill */}
            <div className="flex items-center justify-between px-3 py-2 rounded-t-xl bg-white dark:bg-[#18181b] border-t border-x border-slate-200 dark:border-white/10 shadow-2xs">
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200 truncate">
                  {stage.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="rounded-full px-1.5 py-0.2 text-[10px] font-mono font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300">
                  {count}
                </span>
              </div>
            </div>

            {/* Cards Rail Container */}
            <div
              className="rounded-b-2xl p-2 border border-slate-200 dark:border-white/[0.08] min-h-[460px] space-y-2.5 transition-colors"
              style={{
                backgroundColor: stage.tintColor || `${stage.color}15`,
              }}
            >
              {stage.cards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => onCardClick?.(card, stage)}
                  className="rounded-xl bg-white hover:bg-slate-50 dark:bg-[#17171a] dark:hover:bg-[#1a1a1d] p-2.5 text-xs shadow-xs border border-slate-200 dark:border-[#414141] cursor-grab transition-all duration-150 active:scale-[0.99] group"
                >
                  {/* Top card row: Temperature, relative date, and deal size */}
                  <div className="flex items-center justify-between gap-1 text-[11px] mb-1.5">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                      {renderTemperatureIcon(card.temperature)}
                      <span className="text-[10px]">{card.relativeDate}</span>
                    </div>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white text-[11px] bg-slate-100 dark:bg-[#222226] px-1.5 py-0.2 rounded border border-slate-200/50 dark:border-white/5">
                      {card.dealSize}
                    </span>
                  </div>

                  {/* Lead name & job title */}
                  <div className="mb-2">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {card.leadName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {card.jobTitle}
                    </div>
                  </div>

                  {/* Bottom card row: Overlapping avatars and SLA follow-up chip */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-white/5">
                    {/* Overlapping Avatars */}
                    <div className="flex items-center -space-x-1">
                      {card.avatars.map((av, idx) => (
                        <div
                          key={idx}
                          className="w-5 h-5 rounded-full border-2 border-white dark:border-[#17171a] bg-slate-200 dark:bg-zinc-700 text-[9px] font-semibold flex items-center justify-center text-slate-700 dark:text-zinc-200"
                          title={av}
                        >
                          {av.slice(0, 2).toUpperCase()}
                        </div>
                      ))}
                    </div>

                    {/* SLA Follow-Up Chip */}
                    <div className="flex items-center gap-1 text-[10px] bg-slate-50 dark:bg-[#202024] px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-zinc-300">
                      {renderChannelIcon(card.slaFollowUp.channel)}
                      <Clock className="w-2.5 h-2.5 text-slate-400 dark:text-zinc-500" />
                      <span>{card.slaFollowUp.time}</span>
                    </div>
                  </div>
                </div>
              ))}

              {stage.cards.length === 0 && (
                <div className="h-28 flex items-center justify-center text-[11px] text-slate-400 dark:text-zinc-500 italic border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                  Empty Stage
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
