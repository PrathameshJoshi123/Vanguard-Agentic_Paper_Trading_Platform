"use client";

import { TAccountsOverview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

interface TAccountsCardProps {
  tAccounts: TAccountsOverview | null;
}

export function TAccountsCard({ tAccounts }: TAccountsCardProps) {
  if (!tAccounts) {
    return (
      <div className="py-8 text-center text-slate-400 text-xs">
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
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          is_balanced
            ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
            : "bg-rose-50/80 border-rose-200 text-rose-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              is_balanced
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
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
              <Badge
                variant="outline"
                className={`text-[10px] py-0 font-mono font-semibold ${
                  is_balanced
                    ? "bg-white text-emerald-800 border-emerald-300"
                    : "bg-white text-rose-800 border-rose-300"
                }`}
              >
                {is_balanced ? "₹0.00 DISCREPANCY" : `₹${discrepancy.toFixed(2)} IMBALANCE`}
              </Badge>
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

      {/* Modern Financial Ledger Card Grid (Option B) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {accounts.map((acc) => {
          const debits = Number(acc.total_debits);
          const credits = Number(acc.total_credits);
          const net = Number(acc.net_balance);
          const totalVol = debits + credits;
          const debitPct = totalVol > 0 ? (debits / totalVol) * 100 : 50;
          const creditPct = totalVol > 0 ? (credits / totalVol) * 100 : 50;

          const isAsset = acc.category.includes("CASH");
          const isRevenue = acc.category.includes("REVENUE");
          const isLiability =
            acc.category.includes("PAYABLE") ||
            acc.category.includes("SETTLEMENT");

          return (
            <Card
              key={acc.category}
              className="bg-white border-slate-200 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <CardHeader className="py-2.5 px-3.5 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-[11px] font-bold text-slate-800 truncate">
                  {acc.category.replace(/_/g, " ")}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`text-[9px] py-0 uppercase ${
                    isAsset
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : isRevenue
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {isAsset ? "Asset" : isRevenue ? "Revenue" : "Liability"}
                </Badge>
              </CardHeader>
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex justify-between items-baseline font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      Dr. (Debits)
                    </span>
                    <span className="font-semibold text-slate-800">
                      ₹{debits.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-sans">
                      Cr. (Credits)
                    </span>
                    <span className="font-semibold text-slate-800">
                      ₹{credits.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Split Visual Balance Bar */}
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${debitPct}%` }}
                    className="bg-blue-500 h-full"
                    title={`Debits: ${debitPct.toFixed(1)}%`}
                  />
                  <div
                    style={{ width: `${creditPct}%` }}
                    className="bg-slate-400 h-full"
                    title={`Credits: ${creditPct.toFixed(1)}%`}
                  />
                </div>

                <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Net Balance:</span>
                  <span
                    className={`font-mono font-bold ${
                      net > 0
                        ? "text-blue-700"
                        : net < 0
                        ? "text-amber-700"
                        : "text-slate-600"
                    }`}
                  >
                    {net >= 0 ? "Dr. " : "Cr. "}₹{Math.abs(net).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
