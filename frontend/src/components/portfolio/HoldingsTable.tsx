"use client";

import { Holding } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTradingStore } from "@/store/useTradingStore";
import { TrendingUp, TrendingDown, Layers } from "lucide-react";

interface HoldingsTableProps {
  holdings: Holding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const marketDepth = useTradingStore((s) => s.marketDepth);

  if (holdings.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="font-medium text-slate-600">No delivery holdings in Demat</p>
        <p className="text-xs text-slate-400 mt-1">
          Buy shares with product type <strong>CNC</strong> on the Trading Terminal to add to your long-term inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader className="bg-slate-50/80">
          <TableRow className="border-b border-slate-200">
            <TableHead className="font-semibold text-slate-600">Symbol</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Quantity</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Avg Buy Price</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Current LTP</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Invested Capital</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Current Value</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Total Return</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.map((h) => {
            const currentLtp =
              marketDepth[h.symbol]?.ltp ||
              (h.average_buy_price ? Number(h.average_buy_price) : 0);
            const avgPrice = Number(h.average_buy_price || h.average_price || 0);
            const qty = h.quantity;

            const invested = avgPrice * qty;
            const currentValue = currentLtp * qty;
            const pnl = currentValue - invested;
            const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

            return (
              <TableRow
                key={h.symbol}
                className="hover:bg-slate-50/60 transition-colors border-b border-slate-100"
              >
                <TableCell className="font-bold text-slate-900 font-mono">
                  {h.symbol}
                  <Badge
                    variant="outline"
                    className="ml-2 text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0"
                  >
                    CNC Demat
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-slate-900">
                  {qty}
                </TableCell>
                <TableCell className="text-right font-mono text-slate-700">
                  ₹{avgPrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-slate-900">
                  ₹{currentLtp.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-slate-700">
                  ₹{invested.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-slate-900">
                  ₹{currentValue.toFixed(2)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono font-bold ${
                    pnl > 0
                      ? "text-emerald-600"
                      : pnl < 0
                      ? "text-rose-600"
                      : "text-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-end gap-1">
                    {pnl > 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-500 inline" />
                    ) : pnl < 0 ? (
                      <TrendingDown className="w-3 h-3 text-rose-500 inline" />
                    ) : null}
                    <span>
                      {pnl > 0 ? "+" : ""}₹{pnl.toFixed(2)} ({pnlPct > 0 ? "+" : ""}
                      {pnlPct.toFixed(2)}%)
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
