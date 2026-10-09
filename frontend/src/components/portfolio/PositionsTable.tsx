"use client";

import React, { useState } from "react";
import { Position } from "@/lib/types";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  DataTableToolbar,
  DataTableContainer,
  DataTableHead,
  DataTableRow,
  FilterPill,
} from "@/components/ui/northstar/DataTable";
import { TrendingUp, TrendingDown, RefreshCw, XCircle } from "lucide-react";

interface PositionsTableProps {
  positions: Position[];
  onRefresh: () => void;
}

export function PositionsTable({ positions, onRefresh }: PositionsTableProps) {
  const accountId = useTradingStore((s) => s.accountId);
  const marketDepth = useTradingStore((s) => s.marketDepth);
  const [squaringOffSymbol, setSquaringOffSymbol] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "LONG" | "SHORT" | "MIS">("ALL");

  const handleSquareOff = async (symbol: string) => {
    setSquaringOffSymbol(symbol);
    try {
      await api.squareOffPosition(symbol, accountId);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Square-off failed";
      alert(`Square-off failed for ${symbol}: ${msg}`);
    } finally {
      setSquaringOffSymbol(null);
    }
  };

  const filteredPositions = positions.filter((pos) => {
    // Search query match
    if (
      searchQuery &&
      !pos.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !pos.product_type.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Filter pill match
    if (activeFilter === "LONG" && pos.quantity <= 0) return false;
    if (activeFilter === "SHORT" && pos.quantity >= 0) return false;
    if (activeFilter === "MIS" && pos.product_type !== "MIS") return false;

    return true;
  });

  const filterPills: FilterPill[] = [
    { id: "ALL", label: "All Positions", active: activeFilter === "ALL", count: positions.length },
    {
      id: "LONG",
      label: "Long only",
      active: activeFilter === "LONG",
      count: positions.filter((p) => p.quantity > 0).length,
    },
    {
      id: "SHORT",
      label: "Short only",
      active: activeFilter === "SHORT",
      count: positions.filter((p) => p.quantity < 0).length,
    },
    {
      id: "MIS",
      label: "MIS (5x)",
      active: activeFilter === "MIS",
      count: positions.filter((p) => p.product_type === "MIS").length,
    },
  ];

  if (positions.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-sm">
        <p className="font-medium text-slate-700 dark:text-zinc-300">No active positions</p>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
          Execute a BUY or SELL order on the Trading Terminal to open a position.
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
        searchPlaceholder="Filter positions by symbol or product..."
        filterPills={filterPills}
        onToggleFilter={(id) => setActiveFilter(id as any)}
      />

      {/* Northstar Table */}
      <DataTableContainer>
        <table className="w-full text-left border-collapse">
          <DataTableHead>
            <tr>
              <th className="py-2.5 px-4 font-semibold">Symbol</th>
              <th className="py-2.5 px-4 font-semibold">Product</th>
              <th className="py-2.5 px-4 font-semibold text-right">Net Qty</th>
              <th className="py-2.5 px-4 font-semibold text-right">Avg Price</th>
              <th className="py-2.5 px-4 font-semibold text-right">LTP</th>
              <th className="py-2.5 px-4 font-semibold text-right">Realized P&amp;L</th>
              <th className="py-2.5 px-4 font-semibold text-right">Unrealized MTM</th>
              <th className="py-2.5 px-4 font-semibold text-right">Net P&amp;L</th>
              <th className="py-2.5 px-4 font-semibold text-center">Action</th>
            </tr>
          </DataTableHead>
          <tbody>
            {filteredPositions.map((pos) => {
              const currentLtp = Number(
                marketDepth[pos.symbol]?.ltp ||
                pos.last_price ||
                pos.average_price ||
                0
              );

              const qty = Number(pos.quantity || 0);
              const avgPrice = Number(pos.average_price || 0);
              const realizedPnl = Number(pos.realized_pnl || 0);
              const totalCharges = Number(pos.total_charges || 0);
              const isLong = qty > 0;
              const isShort = qty < 0;
              const liveMtm =
                qty !== 0
                  ? (currentLtp - avgPrice) * qty
                  : Number(pos.unrealized_pnl || 0);

              const netPnl = realizedPnl + liveMtm - totalCharges;

              return (
                <DataTableRow key={`${pos.symbol}-${pos.product_type}`}>
                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                    {pos.symbol}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      style={CONTROL_SHADOW_STYLE}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                        pos.product_type === "MIS"
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      {pos.product_type} {pos.product_type === "MIS" ? "5x" : "CNC"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold">
                    <span
                      className={
                        isLong
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isShort
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-500"
                      }
                    >
                      {qty > 0 ? `+${qty}` : qty}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-zinc-300">
                    ₹{avgPrice.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    ₹{currentLtp.toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono font-semibold ${
                      realizedPnl > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : realizedPnl < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-500"
                    }`}
                  >
                    {realizedPnl > 0 ? "+" : ""}
                    ₹{realizedPnl.toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono font-semibold ${
                      liveMtm > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : liveMtm < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {liveMtm > 0 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-500 inline" />
                      ) : liveMtm < 0 ? (
                        <TrendingDown className="w-3 h-3 text-rose-500 inline" />
                      ) : null}
                      <span>
                        {liveMtm > 0 ? "+" : ""}₹{liveMtm.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono font-bold ${
                      netPnl > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : netPnl < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    {netPnl > 0 ? "+" : ""}₹{netPnl.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {pos.quantity !== 0 ? (
                      <button
                        type="button"
                        style={CONTROL_SHADOW_STYLE}
                        className="h-7 px-3 rounded-full text-[11px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer transition-all inline-flex items-center gap-1 font-medium disabled:opacity-50"
                        disabled={squaringOffSymbol === pos.symbol}
                        onClick={() => handleSquareOff(pos.symbol)}
                      >
                        {squaringOffSymbol === pos.symbol ? (
                          <RefreshCw className="w-3 h-3 animate-spin mr-0.5" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-0.5" />
                        )}
                        Square-Off
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                        Closed
                      </span>
                    )}
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
