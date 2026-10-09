"use client";

import React from "react";
import { ContractNoteSummary } from "@/lib/types";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { ReceiptText } from "lucide-react";

interface ContractNoteCardProps {
  summary: ContractNoteSummary | null;
}

export function ContractNoteCard({ summary }: ContractNoteCardProps) {
  if (!summary) return null;

  const totalCharges = Number(summary.total_charges || 0);

  const items = [
    {
      title: "Brokerage Fee",
      value: summary.total_brokerage,
      hint: "₹20 or 0.03% cap",
    },
    {
      title: "STT (Securities Tax)",
      value: summary.total_stt,
      hint: "CNC 0.1% / MIS 0.025%",
    },
    {
      title: "Exchange Turnover",
      value: summary.total_exchange_turnover,
      hint: "NSE 0.00297% levy",
    },
    {
      title: "SEBI Regulatory",
      value: summary.total_sebi_fees,
      hint: "₹10 per crore",
    },
    {
      title: "Stamp Duty",
      value: summary.total_stamp_duty,
      hint: "0.015% on buy legs",
    },
    {
      title: "GST (18%)",
      value: summary.total_gst,
      hint: "18% on fees",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
            Contract Note Tax &amp; Regulatory Charges
          </h3>
        </div>
        <span
          style={CONTROL_SHADOW_STYLE}
          className="rounded-full px-2 py-0.5 text-[10px] font-mono font-medium bg-slate-50 dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
        >
          Settled Trades: {summary.trades_count}
        </span>
      </div>

      {/* Grid of 6 tax components */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((it) => (
          <div
            key={it.title}
            style={CONTROL_SHADOW_STYLE}
            className="p-3 bg-slate-50/70 dark:bg-[#141417] border border-slate-200/80 dark:border-white/10 rounded-xl space-y-1"
          >
            <span className="text-[10px] uppercase text-slate-400 dark:text-zinc-500 block font-semibold truncate">
              {it.title}
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm block">
              ₹{Number(it.value).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
              {it.hint}
            </span>
          </div>
        ))}
      </div>

      {/* Footer Total */}
      <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-between items-center">
        <span className="font-semibold text-xs text-slate-700 dark:text-zinc-300">
          Total Statutory Levies Deducted:
        </span>
        <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
          ₹{totalCharges.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
