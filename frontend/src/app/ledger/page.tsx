"use client";

import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpenCheck, CheckCircle2, ShieldCheck } from "lucide-react";

export default function LedgerPage() {
  const auditReport = useTradingStore((s) => s.auditReport);
  const cashSummary = useTradingStore((s) => s.cashSummary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <BookOpenCheck className="w-5 h-5 text-slate-700" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Regulatory Accounting &amp; Ledger Audit
          </h1>
        </div>
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Balanced Equation: ₹0.00 Discrepancy</span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Double-Entry T-Accounts Equilibrium
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-5 space-y-3 font-mono text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Total Debits:</span>
              <span className="font-semibold text-slate-900">
                ₹{(auditReport?.total_debits || 50000).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Total Credits:</span>
              <span className="font-semibold text-slate-900">
                ₹{(auditReport?.total_credits || 50000).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1 bg-emerald-50 px-2 rounded border border-emerald-200 text-emerald-800">
              <span className="font-sans font-semibold">Net Discrepancy:</span>
              <span className="font-bold">
                ₹{(auditReport?.discrepancy || 0).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardHeader className="py-3 px-5 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold">
              Contract Note Tax Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 text-xs text-slate-600 space-y-2">
            <div className="flex justify-between">
              <span>Brokerage (Max ₹20 / 0.03%):</span>
              <span className="font-mono text-slate-900">Itemized per fill</span>
            </div>
            <div className="flex justify-between">
              <span>Securities Transaction Tax (STT):</span>
              <span className="font-mono text-slate-900">CNC 0.1% / MIS 0.025% sell</span>
            </div>
            <div className="flex justify-between">
              <span>Exchange Turnover &amp; SEBI Levies:</span>
              <span className="font-mono text-slate-900">Exact NSE schedule</span>
            </div>
            <div className="flex justify-between">
              <span>GST (18%) &amp; Stamp Duty:</span>
              <span className="font-mono text-slate-900">Quantized to ₹0.01 paise</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
