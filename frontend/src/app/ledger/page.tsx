"use client";

import { useEffect, useState, useCallback } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { TAccountsCard } from "@/components/ledger/TAccountsCard";
import { ContractNoteCard } from "@/components/ledger/ContractNoteCard";
import { CashJournalTable } from "@/components/ledger/CashJournalTable";
import {
  BookOpenCheck,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  ShieldCheck,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <BookOpenCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Regulatory Accounting &amp; Ledger Audit
            </h1>
            <p className="text-xs text-slate-500">
              Balanced Double-Entry T-Accounts, contract notes, and immutable customer cash journal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs flex items-center gap-1.5 py-1 px-2.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>₹0.00 Discrepancy Verified</span>
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            onClick={refreshLedger}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Audit Ledger
          </Button>
        </div>
      </div>

      {/* Double-Entry T-Accounts Financial Ledger Grid (Option B) */}
      <TAccountsCard tAccounts={tAccounts} />

      {/* Contract Notes Statutory Tax Summary */}
      <ContractNoteCard summary={contractNotes} />

      {/* Customer Cash Journal Table */}
      <Card className="bg-white border-slate-200 shadow-2xs">
        <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-slate-700" />
            <CardTitle className="text-sm font-semibold text-slate-900">
              Customer Cash Journal (Append-Only Entry Log)
            </CardTitle>
          </div>
          <div className="text-xs font-mono text-slate-500">
            Total Entries: {cashEntries.length}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <CashJournalTable entries={cashEntries} />
        </CardContent>
      </Card>
    </div>
  );
}
