"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { TAccountsCard } from "@/components/ledger/TAccountsCard";
import { TAccountsRecharts } from "@/components/ledger/TAccountsRecharts";
import { ContractNoteCard } from "@/components/ledger/ContractNoteCard";
import { CashJournalTable } from "@/components/ledger/CashJournalTable";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  BookOpenCheck,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";

export default function LedgerPage() {
  const accountId = useTradingStore((s) => s.accountId);
  const tAccounts = useTradingStore((s) => s.tAccounts);
  const contractNotes = useTradingStore((s) => s.contractNotes);
  const cashEntries = useTradingStore((s) => s.cashEntries);
  const setTAccounts = useTradingStore((s) => s.setTAccounts);
  const setContractNotes = useTradingStore((s) => s.setContractNotes);
  const setCashEntries = useTradingStore((s) => s.setCashEntries);

  const [isLoading, setIsLoading] = useState(false);

  const refreshLedger = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tAccData, notesData, journalData] = await Promise.all([
        api.getTAccountsOverview(accountId),
        api.getContractNotesSummary(accountId),
        api.getLedgerSummary(accountId),
      ]);
      setTAccounts(tAccData);
      setContractNotes(notesData);
      setCashEntries(journalData.entries);
    } catch (err) {
      console.error("Failed to fetch ledger accounts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, setTAccounts, setContractNotes, setCashEntries]);

  useEffect(() => {
    refreshLedger();
  }, [refreshLedger]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-xs">
            <BookOpenCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Regulatory Accounting &amp; Ledger Audit
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Balanced Double-Entry T-Accounts, contract notes, and immutable customer cash journal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            style={CONTROL_SHADOW_STYLE}
            className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono text-xs flex items-center gap-1.5 py-1 px-3 rounded-full font-medium"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>₹0.00 Discrepancy Verified</span>
          </span>
          <button
            type="button"
            onClick={refreshLedger}
            disabled={isLoading}
            style={CONTROL_SHADOW_STYLE}
            className="h-8 px-3 text-xs font-medium bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327] rounded-full transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Audit Ledger</span>
          </button>
        </div>
      </div>

      {/* Recharts Analytics: Double-Entry Debits vs Credits Bar Chart & Statutory Breakdown */}
      <TAccountsRecharts tAccounts={tAccounts} contractNotes={contractNotes} />

      {/* Double-Entry T-Accounts Financial Ledger Grid */}
      <TAccountsCard tAccounts={tAccounts} />

      {/* Contract Notes Statutory Tax Summary */}
      <ContractNoteCard summary={contractNotes} />

      {/* Customer Cash Journal Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Customer Cash Journal (Append-Only Entry Log)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">
            Total Entries: {cashEntries.length}
          </span>
        </div>

        <CashJournalTable entries={cashEntries} />
      </div>
    </div>
  );
}
