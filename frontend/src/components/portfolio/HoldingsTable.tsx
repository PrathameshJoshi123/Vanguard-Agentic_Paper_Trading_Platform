"use client";

import React, { useState } from "react";
import { Holding } from "@/lib/types";
import { useTradingStore } from "@/store/useTradingStore";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  DataTableToolbar,
  DataTableContainer,
  DataTableHead,
  DataTableRow,
  FilterPill,
} from "@/components/ui/northstar/DataTable";
import { TrendingUp, TrendingDown, Layers } from "lucide-react";

interface HoldingsTableProps {
  holdings: Holding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  const marketDepth = useTradingStore((s) => s.marketDepth);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PROFIT" | "LOSS">("ALL");

  const filteredHoldings = holdings.filter((h) => {
    if (searchQuery && !h.symbol.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    const currentLtp =
      marketDepth[h.symbol]?.ltp || (h.average_buy_price ? Number(h.average_buy_price) : 0);
    const avgPrice = Number(h.average_buy_price || h.average_price || 0);
    const pnl = (currentLtp - avgPrice) * h.quantity;

    if (activeFilter === "PROFIT" && pnl < 0) return false;
    if (activeFilter === "LOSS" && pnl > 0) return false;

    return true;
  });

  const filterPills: FilterPill[] = [
    { id: "ALL", label: "All Demat", active: activeFilter === "ALL", count: holdings.length },
    {
      id: "PROFIT",
      label: "In Profit",
      active: activeFilter === "PROFIT",
      count: holdings.filter((h) => {
        const ltp = marketDepth[h.symbol]?.ltp || Number(h.average_buy_price || 0);
        return (ltp - Number(h.average_buy_price || 0)) >= 0;
      }).length,
    },
    {
      id: "LOSS",
      label: "In Loss",
      active: activeFilter === "LOSS",
      count: holdings.filter((h) => {
        const ltp = marketDepth[h.symbol]?.ltp || Number(h.average_buy_price || 0);
        return (ltp - Number(h.average_buy_price || 0)) < 0;
      }).length,
    },
  ];

  if (holdings.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-sm">
        <Layers className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
        <p className="font-medium text-slate-700 dark:text-zinc-300">No delivery holdings in Demat</p>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
          Buy shares with product type <strong>CNC</strong> on the Trading Terminal to add to your long-term inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & Filter Toolbar */}
      <DataTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Filter holdings by symbol..."
        filterPills={filterPills}
        onToggleFilter={(id) => setActiveFilter(id as any)}
      />

      {/* Northstar Table */}
      <DataTableContainer>
        <table className="w-full text-left border-collapse">
          <DataTableHead>
            <tr>
              <th className="py-2.5 px-4 font-semibold">Symbol</th>
              <th className="py-2.5 px-4 font-semibold text-right">Quantity</th>
              <th className="py-2.5 px-4 font-semibold text-right">Avg Buy Price</th>
              <th className="py-2.5 px-4 font-semibold text-right">Current LTP</th>
              <th className="py-2.5 px-4 font-semibold text-right">Invested Capital</th>
              <th className="py-2.5 px-4 font-semibold text-right">Current Value</th>
              <th className="py-2.5 px-4 font-semibold text-right">Total Return</th>
            </tr>
          </DataTableHead>
          <tbody>
            {filteredHoldings.map((h) => {
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
                <DataTableRow key={h.symbol}>
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                    {h.symbol}
                    <span
                      style={CONTROL_SHADOW_STYLE}
                      className="ml-2 text-[10px] font-mono rounded-full px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    >
                      CNC Demat
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    {qty}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-zinc-300">
                    ₹{avgPrice.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    ₹{currentLtp.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-zinc-300">
                    ₹{invested.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    ₹{currentValue.toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono font-bold ${
                      pnl > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : pnl < 0
                        ? "text-rose-600 dark:text-rose-400"
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
                  </td>
                </DataTableRow>
              );
            })}
          </tbody>
        </table>
      </DataTableContainer>
    </div>
  );
}
