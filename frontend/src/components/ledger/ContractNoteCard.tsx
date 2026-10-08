"use client";

import { ContractNoteSummary } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptText, FileText } from "lucide-react";

interface ContractNoteCardProps {
  summary: ContractNoteSummary | null;
}

export function ContractNoteCard({ summary }: ContractNoteCardProps) {
  if (!summary) return null;

  const totalCharges = Number(summary.total_charges || 0);

  return (
    <Card className="bg-white border-slate-200 shadow-2xs">
      <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-4 h-4 text-slate-700" />
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Contract Note Tax &amp; Regulatory Charges
          </CardTitle>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Settled Trades: {summary.trades_count}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-2.5 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">
              Brokerage Fee
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              ₹{Number(summary.total_brokerage).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              ₹20 or 0.03% cap
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">
              STT (Securities Tax)
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              ₹{Number(summary.total_stt).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              CNC 0.1% / MIS 0.025%
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">
              Exchange Turnover
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              ₹{Number(summary.total_exchange_turnover).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              NSE 0.00297% levy
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">
              SEBI Regulatory
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              ₹{Number(summary.total_sebi_fees).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              ₹10 per crore
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">
              Stamp Duty
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              ₹{Number(summary.total_stamp_duty).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              0.015% on buy legs
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">
              GST (18%)
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              ₹{Number(summary.total_gst).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              18% on fees
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
          <span className="font-semibold text-slate-700">
            Total Statutory Deductions:
          </span>
          <span className="font-mono font-bold text-base text-slate-900">
            ₹{totalCharges.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
