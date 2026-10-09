"use client";

import React from "react";
import { TAccountsOverview } from "@/lib/types";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

interface TAccountsCardProps {
  tAccounts: TAccountsOverview | null;
}

export function TAccountsCard({ tAccounts }: TAccountsCardProps) {
  if (!tAccounts) {
    return (
      <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs font-mono">
        Loading double-entry ledger accounts...
      </div>
    );
  }

  const { total_debits, total_credits, discrepancy, is_balanced, accounts } =
    tAccounts;

  return (
    <div className="space-y-4">
      {/* Top Equilibrium Summary Banner */}
      <div
        style={CONTROL_SHADOW_STYLE}
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          is_balanced
            ? "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300"
            : "bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              is_balanced
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400"
            }`}
          >
            {is_balanced ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Double-Entry Accounting Equilibrium
              </span>
              <span
                style={CONTROL_SHADOW_STYLE}
                className={`text-[10px] py-0.5 px-2 rounded-full font-mono font-bold border ${
                  is_balanced
                    ? "bg-white dark:bg-[#121215] text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                    : "bg-white dark:bg-[#121215] text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                }`}
              >
                {is_balanced ? "₹0.00 DISCREPANCY" : `₹${discrepancy.toFixed(2)} IMBALANCE`}
              </span>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              Fundamental Accounting Equation: Total Debits (₹
              {Number(total_debits).toFixed(2)}) == Total Credits (₹
              {Number(total_credits).toFixed(2)})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-center font-mono text-xs">
          <div>
            <span className="text-[10px] uppercase opacity-70 block">Total Debits</span>
            <span className="font-bold">₹{Number(total_debits).toFixed(2)}</span>
          </div>
          <span className="text-slate-400 font-sans text-sm">=</span>
          <div>
            <span className="text-[10px] uppercase opacity-70 block">Total Credits</span>
            <span className="font-bold">₹{Number(total_credits).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Modern Financial Ledger Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {accounts.map((acc) => {
          const debits = Number(acc.total_debits);
          const credits = Number(acc.total_credits);
          const net = Number(acc.net_balance);
          const totalVol = debits + credits;
          const debitPct = totalVol > 0 ? (debits / totalVol) * 100 : 50;

          return (
            <div
              key={acc.category}
              style={CONTROL_SHADOW_STYLE}
              className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 font-mono truncate">
                  {acc.category.replace(/_/g, " ")}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-400">
                  T-Account
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-emerald-500/20 rounded-full overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${debitPct}%` }}
                />
              </div>

              {/* Debits / Credits Split */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                <div>
                  <span className="text-slate-400 dark:text-zinc-500 text-[10px] block">
                    Debits (Dr.)
                  </span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    ₹{debits.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 dark:text-zinc-500 text-[10px] block">
                    Credits (Cr.)
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ₹{credits.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500 dark:text-zinc-400 font-sans text-[11px]">
                  Net Balance:
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{net.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
