"use client";

import React, { useState } from "react";
import { Trade } from "@/lib/types";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  DataTableToolbar,
  DataTableContainer,
  DataTableHead,
  DataTableRow,
  FilterPill,
} from "@/components/ui/northstar/DataTable";
import { ChevronDown, ChevronRight, Activity, GitFork } from "lucide-react";

interface TradeHistoryTableProps {
  trades: Trade[];
}

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");

  const filteredTrades = trades.filter((trade) => {
    if (
      searchQuery &&
      !trade.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !trade.trade_id.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !trade.order_id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (activeFilter === "BUY" && trade.side !== "BUY") return false;
    if (activeFilter === "SELL" && trade.side !== "SELL") return false;
    return true;
  });

  const filterPills: FilterPill[] = [
    { id: "ALL", label: "All Fills", active: activeFilter === "ALL", count: trades.length },
    {
      id: "BUY",
      label: "Buy Trades",
      active: activeFilter === "BUY",
      count: trades.filter((t) => t.side === "BUY").length,
    },
    {
      id: "SELL",
      label: "Sell Trades",
      active: activeFilter === "SELL",
      count: trades.filter((t) => t.side === "SELL").length,
    },
  ];

  if (trades.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-sm">
        <Activity className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
        <p className="font-medium text-slate-700 dark:text-zinc-300">No trade executions yet</p>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
          Filled market orders and matched limit orders will be logged here with atomic match legs.
        </p>
      </div>
    );
  }

  const toggleExpand = (tradeId: string) => {
    setExpandedTradeId((prev) => (prev === tradeId ? null : tradeId));
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <DataTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search trade ID, order ID, or symbol..."
        filterPills={filterPills}
        onToggleFilter={(id) => setActiveFilter(id as any)}
      />

      {/* Northstar Table */}
      <DataTableContainer>
        <table className="w-full text-left border-collapse">
          <DataTableHead>
            <tr>
              <th className="w-8 py-2.5 px-3"></th>
              <th className="py-2.5 px-4 font-semibold">Time</th>
              <th className="py-2.5 px-4 font-semibold">Trade ID</th>
              <th className="py-2.5 px-4 font-semibold">Order ID</th>
              <th className="py-2.5 px-4 font-semibold">Symbol</th>
              <th className="py-2.5 px-4 font-semibold">Side</th>
              <th className="py-2.5 px-4 font-semibold text-right">Price</th>
              <th className="py-2.5 px-4 font-semibold text-right">Quantity</th>
              <th className="py-2.5 px-4 font-semibold text-right">Turnover</th>
              <th className="py-2.5 px-4 font-semibold text-center">Liquidity Role</th>
            </tr>
          </DataTableHead>
          <tbody>
            {filteredTrades.map((trade) => {
              const formattedTime = new Date(trade.timestamp).toLocaleTimeString();
              const isBuy = trade.side === "BUY";
              const turnover = trade.price * trade.quantity;
              const isExpanded = expandedTradeId === trade.trade_id;

              return (
                <React.Fragment key={trade.trade_id}>
                  <DataTableRow onClick={() => toggleExpand(trade.trade_id)}>
                    <td className="text-slate-400 dark:text-zinc-500 py-2.5 px-3">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      {formattedTime}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-zinc-300 font-medium">
                      {trade.trade_id.slice(0, 10)}...
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-zinc-400">
                      {trade.order_id.slice(0, 8)}...
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                      {trade.symbol}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        style={CONTROL_SHADOW_STYLE}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          isBuy
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        {trade.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      ₹{trade.price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300">
                      {trade.quantity}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ₹{turnover.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        style={CONTROL_SHADOW_STYLE}
                        className="rounded-full px-2 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
                      >
                        TAKER
                      </span>
                    </td>
                  </DataTableRow>

                  {/* Expanded atomic trade breakdown row */}
                  {isExpanded && (
                    <tr className="bg-slate-50/70 dark:bg-[#141417] border-b border-slate-100 dark:border-white/5">
                      <td colSpan={10} className="p-4 pl-12">
                        <div
                          style={CONTROL_SHADOW_STYLE}
                          className="rounded-xl p-3 bg-white dark:bg-[#18181b] border border-slate-200/80 dark:border-white/10 text-xs font-mono space-y-2"
                        >
                          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-zinc-200">
                            <GitFork className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Atomic Match Verification (Paise-Precision Execution)</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px]">
                            <div>
                              <span className="text-slate-400 dark:text-zinc-500 block">Match Engine:</span>
                              <span className="font-semibold text-slate-900 dark:text-white">Continuous L2 Book</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-zinc-500 block">Timestamp:</span>
                              <span className="font-semibold text-slate-900 dark:text-white">{trade.timestamp}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-zinc-500 block">Total Settlement:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{turnover.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-zinc-500 block">Contract Leg:</span>
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400">Matched Leg 1 of 1</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </DataTableContainer>
    </div>
  );
}
