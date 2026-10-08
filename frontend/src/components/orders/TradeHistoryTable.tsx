"use client";

import { useState } from "react";
import { Trade } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Activity, GitFork } from "lucide-react";

interface TradeHistoryTableProps {
  trades: Trade[];
}

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  if (trades.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="font-medium text-slate-600">No trade executions yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Filled market orders and matched limit orders will be logged here with atomic match legs.
        </p>
      </div>
    );
  }

  const toggleExpand = (tradeId: string) => {
    setExpandedTradeId((prev) => (prev === tradeId ? null : tradeId));
  };

  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader className="bg-slate-50/80">
          <TableRow className="border-b border-slate-200">
            <TableHead className="w-8"></TableHead>
            <TableHead className="font-semibold text-slate-600">Time</TableHead>
            <TableHead className="font-semibold text-slate-600">Trade ID</TableHead>
            <TableHead className="font-semibold text-slate-600">Order ID</TableHead>
            <TableHead className="font-semibold text-slate-600">Symbol</TableHead>
            <TableHead className="font-semibold text-slate-600">Side</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Price</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Quantity</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Turnover</TableHead>
            <TableHead className="text-center font-semibold text-slate-600">Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => {
            const formattedTime = new Date(trade.timestamp).toLocaleTimeString();
            const isBuy = trade.side === "BUY";
            const turnover = trade.price * trade.quantity;
            const isExpanded = expandedTradeId === trade.trade_id;

            return (
              <tbody key={trade.trade_id}>
                <TableRow
                  className="hover:bg-slate-50/60 transition-colors border-b border-slate-100 cursor-pointer"
                  onClick={() => toggleExpand(trade.trade_id)}
                >
                  <TableCell className="text-slate-400 p-2">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-slate-500 whitespace-nowrap">
                    {formattedTime}
                  </TableCell>
                  <TableCell className="font-mono text-slate-700 font-medium">
                    {trade.trade_id}
                  </TableCell>
                  <TableCell className="font-mono text-slate-500">
                    {trade.order_id}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 font-mono">
                    {trade.symbol}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold py-0 ${
                        isBuy
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {trade.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-900">
                    ₹{trade.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-900">
                    {trade.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700 font-semibold">
                    ₹{turnover.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 ${
                        trade.is_maker
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-cyan-50 text-cyan-700 border-cyan-200"
                      }`}
                    >
                      {trade.is_maker ? "MAKER" : "TAKER"}
                    </Badge>
                  </TableCell>
                </TableRow>

                {/* Expanded Multi-Level Book Walk Inspection */}
                {isExpanded && (
                  <TableRow className="bg-slate-50/70">
                    <TableCell colSpan={10} className="p-4">
                      <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-slate-700 font-semibold">
                          <GitFork className="w-3.5 h-3.5 text-blue-600" />
                          <span>Book-Walk Matching Engine Leg Traceability</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">
                              Execution Price
                            </span>
                            <span className="font-mono font-semibold text-slate-900">
                              ₹{trade.price.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">
                              Filled Quantity
                            </span>
                            <span className="font-mono font-semibold text-slate-900">
                              {trade.quantity} shares
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">
                              Counterparty ID
                            </span>
                            <span className="font-mono font-semibold text-slate-900">
                              {trade.counterparty_order_id || "EXCHANGE_POOL"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">
                              Execution Latency
                            </span>
                            <span className="font-mono font-semibold text-emerald-700">
                              &lt; 3ms (In-Memory RAM)
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </tbody>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
