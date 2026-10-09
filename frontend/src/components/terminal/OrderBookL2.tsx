"use client";

import React from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { Layers, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface OrderBookL2Props {
  onSelectPrice?: (price: number) => void;
}

export function OrderBookL2({ onSelectPrice }: OrderBookL2Props) {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);

  const defaultPrice =
    selectedSymbol === "TCS"
      ? 2198.0
      : selectedSymbol === "INFY"
      ? 1012.4
      : 1272.5;

  const ltp = Number(marketDepth?.ltp || defaultPrice);

  // 5-depth levels
  const bids = marketDepth?.bids?.length
    ? marketDepth.bids.slice(0, 5)
    : [
        { price: Number((ltp - 0.5).toFixed(2)), quantity: 120, orders: 12 },
        { price: Number((ltp - 1.0).toFixed(2)), quantity: 240, orders: 18 },
        { price: Number((ltp - 1.5).toFixed(2)), quantity: 380, orders: 24 },
        { price: Number((ltp - 2.0).toFixed(2)), quantity: 510, orders: 31 },
        { price: Number((ltp - 2.5).toFixed(2)), quantity: 650, orders: 42 },
      ];

  const asks = marketDepth?.asks?.length
    ? marketDepth.asks.slice(0, 5)
    : [
        { price: Number((ltp + 0.5).toFixed(2)), quantity: 150, orders: 14 },
        { price: Number((ltp + 1.0).toFixed(2)), quantity: 270, orders: 21 },
        { price: Number((ltp + 1.5).toFixed(2)), quantity: 390, orders: 28 },
        { price: Number((ltp + 2.0).toFixed(2)), quantity: 480, orders: 35 },
        { price: Number((ltp + 2.5).toFixed(2)), quantity: 610, orders: 40 },
      ];

  const bestBid = Number(bids[0]?.price || ltp - 0.5);
  const bestAsk = Number(asks[0]?.price || ltp + 0.5);
  const spread = Math.max(0, Number((bestAsk - bestBid).toFixed(2)));

  const totalBuyQty = bids.reduce((acc, b) => acc + b.quantity, 0);
  const totalSellQty = asks.reduce((acc, a) => acc + a.quantity, 0);
  const maxQty = Math.max(...bids.map((b) => b.quantity), ...asks.map((a) => a.quantity), 1);

  const buyRatio =
    totalBuyQty + totalSellQty > 0
      ? Math.round((totalBuyQty / (totalBuyQty + totalSellQty)) * 100)
      : 50;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
            Market Depth (5-Depth Level 2)
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-slate-400 dark:text-zinc-500 font-sans text-[11px]">Spread:</span>
            <span
              style={CONTROL_SHADOW_STYLE}
              className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-slate-50 dark:bg-[#1e1e22] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
            >
              ₹{spread.toFixed(2)}
            </span>
          </div>
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2.5 py-0.5 text-[11px] font-mono font-bold bg-slate-900 dark:bg-white text-white dark:text-black"
          >
            LTP: ₹{ltp.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Buy/Sell Ratio Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Buyers: {buyRatio}% ({totalBuyQty.toLocaleString()})
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
              Sellers: {100 - buyRatio}% ({totalSellQty.toLocaleString()}) <ArrowDownRight className="w-3 h-3" />
            </span>
          </div>
          <div className="h-1.5 w-full bg-rose-500/20 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${buyRatio}%` }}
            />
          </div>
        </div>

        {/* 2-Column Depth Matrix */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          {/* Bids Column */}
          <div className="border border-emerald-500/20 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#141417]">
            <div className="bg-emerald-500/10 px-3 py-1.5 border-b border-emerald-500/20 flex justify-between text-[11px] font-sans font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <span>Bids (Price)</span>
              <span>Qty (Orders)</span>
            </div>
            <div className="divide-y divide-emerald-500/10">
              {bids.map((b, idx) => {
                const depthPct = Math.round((b.quantity / maxQty) * 100);
                return (
                  <button
                    key={`bid-${idx}`}
                    type="button"
                    onClick={() => onSelectPrice?.(b.price)}
                    className="w-full text-left relative flex justify-between items-center px-3 py-2 hover:bg-emerald-500/10 transition-colors group cursor-pointer"
                    title={`Click to fill price ₹${Number(b.price).toFixed(2)} in order ticket`}
                  >
                    {/* Depth Fill Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none transition-all duration-200"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="relative font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                      ₹{Number(b.price).toFixed(2)}
                    </span>
                    <span className="relative text-slate-700 dark:text-zinc-300 text-[11px]">
                      {b.quantity.toLocaleString()}{" "}
                      <span className="text-slate-400 dark:text-zinc-500 text-[10px]">
                        ({b.orders ?? 1})
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asks Column */}
          <div className="border border-rose-500/20 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#141417]">
            <div className="bg-rose-500/10 px-3 py-1.5 border-b border-rose-500/20 flex justify-between text-[11px] font-sans font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              <span>Asks (Price)</span>
              <span>Qty (Orders)</span>
            </div>
            <div className="divide-y divide-rose-500/10">
              {asks.map((a, idx) => {
                const depthPct = Math.round((a.quantity / maxQty) * 100);
                return (
                  <button
                    key={`ask-${idx}`}
                    type="button"
                    onClick={() => onSelectPrice?.(a.price)}
                    className="w-full text-left relative flex justify-between items-center px-3 py-2 hover:bg-rose-500/10 transition-colors group cursor-pointer"
                    title={`Click to fill price ₹${Number(a.price).toFixed(2)} in order ticket`}
                  >
                    {/* Depth Fill Bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none transition-all duration-200"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="relative font-bold text-rose-600 dark:text-rose-400 group-hover:underline">
                      ₹{Number(a.price).toFixed(2)}
                    </span>
                    <span className="relative text-slate-700 dark:text-zinc-300 text-[11px]">
                      {a.quantity.toLocaleString()}{" "}
                      <span className="text-slate-400 dark:text-zinc-500 text-[10px]">
                        ({a.orders ?? 1})
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 dark:text-zinc-500 text-center font-sans">
          Click any depth level to pre-fill the order price in the execution ticket.
        </div>
      </div>
    </div>
  );
}
