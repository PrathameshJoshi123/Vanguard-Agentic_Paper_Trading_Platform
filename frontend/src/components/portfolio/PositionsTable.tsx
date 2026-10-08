"use client";

import { useState } from "react";
import { Position } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown, RefreshCw, XCircle } from "lucide-react";

interface PositionsTableProps {
  positions: Position[];
  onRefresh: () => void;
}

export function PositionsTable({ positions, onRefresh }: PositionsTableProps) {
  const accountId = useTradingStore((s) => s.accountId);
  const marketDepth = useTradingStore((s) => s.marketDepth);
  const [squaringOffSymbol, setSquaringOffSymbol] = useState<string | null>(null);

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

  if (positions.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        <p className="font-medium text-slate-600">No active positions</p>
        <p className="text-xs text-slate-400 mt-1">
          Execute a BUY or SELL order on the Trading Terminal to open a position.
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
            <TableHead className="font-semibold text-slate-600">Product</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Net Qty</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Avg Price</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">LTP</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Realized P&amp;L</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Unrealized MTM</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Net P&amp;L</TableHead>
            <TableHead className="text-center font-semibold text-slate-600">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((pos) => {
            const currentLtp =
              marketDepth[pos.symbol]?.ltp ||
              pos.last_price ||
              pos.average_price ||
              0;

            // Compute live MTM if position is open
            const isLong = pos.quantity > 0;
            const isShort = pos.quantity < 0;
            const liveMtm =
              pos.quantity !== 0
                ? (currentLtp - (pos.average_price || 0)) * pos.quantity
                : pos.unrealized_pnl || 0;

            const netPnl = (pos.realized_pnl || 0) + liveMtm - (pos.total_charges || 0);

            return (
              <TableRow
                key={`${pos.symbol}-${pos.product_type}`}
                className="hover:bg-slate-50/60 transition-colors border-b border-slate-100"
              >
                <TableCell className="font-bold text-slate-900 font-mono">
                  {pos.symbol}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold py-0 ${
                      pos.product_type === "MIS"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {pos.product_type} {pos.product_type === "MIS" ? "5x" : "CNC"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  <span
                    className={
                      isLong
                        ? "text-emerald-700"
                        : isShort
                        ? "text-rose-700"
                        : "text-slate-500"
                    }
                  >
                    {pos.quantity > 0 ? `+${pos.quantity}` : pos.quantity}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-slate-700">
                  ₹{(pos.average_price || 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-slate-900">
                  ₹{currentLtp.toFixed(2)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono font-semibold ${
                    (pos.realized_pnl || 0) > 0
                      ? "text-emerald-600"
                      : (pos.realized_pnl || 0) < 0
                      ? "text-rose-600"
                      : "text-slate-500"
                  }`}
                >
                  {(pos.realized_pnl || 0) > 0 ? "+" : ""}
                  ₹{(pos.realized_pnl || 0).toFixed(2)}
                </TableCell>
                <TableCell
                  className={`text-right font-mono font-semibold ${
                    liveMtm > 0
                      ? "text-emerald-600"
                      : liveMtm < 0
                      ? "text-rose-600"
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
                </TableCell>
                <TableCell
                  className={`text-right font-mono font-bold ${
                    netPnl > 0
                      ? "text-emerald-700"
                      : netPnl < 0
                      ? "text-rose-700"
                      : "text-slate-600"
                  }`}
                >
                  {netPnl > 0 ? "+" : ""}₹{netPnl.toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  {pos.quantity !== 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px] bg-rose-50/60 text-rose-700 border-rose-200 hover:bg-rose-100 hover:text-rose-800"
                      disabled={squaringOffSymbol === pos.symbol}
                      onClick={() => handleSquareOff(pos.symbol)}
                    >
                      {squaringOffSymbol === pos.symbol ? (
                        <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      Square-Off
                    </Button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Closed</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
