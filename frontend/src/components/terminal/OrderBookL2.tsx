"use client";

import React from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface OrderBookL2Props {
  onSelectPrice?: (price: number) => void;
}

export function OrderBookL2({ onSelectPrice }: OrderBookL2Props) {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);

  // Fallback default levels if stream is initializing
  const bids = marketDepth?.bids?.length
    ? marketDepth.bids.slice(0, 5)
    : [
        { price: 2499.5, quantity: 120, orders: 12 },
        { price: 2499.0, quantity: 240, orders: 18 },
        { price: 2498.5, quantity: 380, orders: 24 },
        { price: 2498.0, quantity: 510, orders: 31 },
        { price: 2497.5, quantity: 650, orders: 42 },
      ];

  const asks = marketDepth?.asks?.length
    ? marketDepth.asks.slice(0, 5)
    : [
        { price: 2500.5, quantity: 150, orders: 14 },
        { price: 2501.0, quantity: 270, orders: 21 },
        { price: 2501.5, quantity: 390, orders: 28 },
        { price: 2502.0, quantity: 480, orders: 35 },
        { price: 2502.5, quantity: 610, orders: 40 },
      ];

  const ltp = marketDepth?.ltp || 2500.0;
  const bestBid = bids[0]?.price || 2499.5;
  const bestAsk = asks[0]?.price || 2500.5;
  const spread = Math.max(0, Number((bestAsk - bestBid).toFixed(2)));

  const totalBuyQty = bids.reduce((acc, b) => acc + b.quantity, 0);
  const totalSellQty = asks.reduce((acc, a) => acc + a.quantity, 0);
  const maxQty = Math.max(...bids.map((b) => b.quantity), ...asks.map((a) => a.quantity), 1);

  const buyRatio =
    totalBuyQty + totalSellQty > 0
      ? Math.round((totalBuyQty / (totalBuyQty + totalSellQty)) * 100)
      : 50;

  return (
    <Card className="bg-white border-slate-200 shadow-xs">
      <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          <CardTitle className="text-sm font-semibold tracking-tight text-slate-800">
            Market Depth (5-Depth Level 2)
          </CardTitle>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-slate-400 font-sans text-[11px]">Spread:</span>
            <span className="font-semibold text-slate-700">₹{spread.toFixed(2)}</span>
          </div>
          <Badge
            variant="outline"
            className="text-[11px] font-mono font-bold bg-slate-50 border-slate-200 text-slate-900 px-2 py-0.5"
          >
            LTP: ₹{ltp.toFixed(2)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Buy/Sell Ratio Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Buyers: {buyRatio}% ({totalBuyQty.toLocaleString()})
            </span>
            <span className="text-rose-700 font-semibold flex items-center gap-1">
              Sellers: {100 - buyRatio}% ({totalSellQty.toLocaleString()}) <ArrowDownRight className="w-3 h-3" />
            </span>
          </div>
          <div className="h-1.5 w-full bg-rose-100 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${buyRatio}%` }}
            />
          </div>
        </div>

        {/* 2-Column Grid: Bids (Left) & Asks (Right) */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          {/* Bids Column */}
          <div className="border border-emerald-100 rounded-lg overflow-hidden bg-white">
            <div className="bg-emerald-50/70 px-3 py-1.5 border-b border-emerald-100 flex justify-between text-[11px] font-sans font-bold text-emerald-900 uppercase tracking-wider">
              <span>Bids (Price)</span>
              <span>Qty (Orders)</span>
            </div>
            <div className="divide-y divide-emerald-50">
              {bids.map((b, idx) => {
                const depthPct = Math.round((b.quantity / maxQty) * 100);
                return (
                  <button
                    key={`bid-${idx}`}
                    type="button"
                    onClick={() => onSelectPrice?.(b.price)}
                    className="w-full text-left relative flex justify-between items-center px-3 py-1.5 hover:bg-emerald-50 transition-colors group cursor-pointer"
                    title={`Click to fill price ₹${b.price.toFixed(2)} in order ticket`}
                  >
                    {/* Depth Fill Bar */}
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none transition-all duration-200"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="relative font-bold text-emerald-700 group-hover:underline">
                      ₹{b.price.toFixed(2)}
                    </span>
                    <span className="relative text-slate-600 text-[11px]">
                      {b.quantity.toLocaleString()}{" "}
                      <span className="text-slate-400 text-[10px]">({b.orders ?? 1})</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asks Column */}
          <div className="border border-rose-100 rounded-lg overflow-hidden bg-white">
            <div className="bg-rose-50/70 px-3 py-1.5 border-b border-rose-100 flex justify-between text-[11px] font-sans font-bold text-rose-900 uppercase tracking-wider">
              <span>Asks (Price)</span>
              <span>Qty (Orders)</span>
            </div>
            <div className="divide-y divide-rose-50">
              {asks.map((a, idx) => {
                const depthPct = Math.round((a.quantity / maxQty) * 100);
                return (
                  <button
                    key={`ask-${idx}`}
                    type="button"
                    onClick={() => onSelectPrice?.(a.price)}
                    className="w-full text-left relative flex justify-between items-center px-3 py-1.5 hover:bg-rose-50 transition-colors group cursor-pointer"
                    title={`Click to fill price ₹${a.price.toFixed(2)} in order ticket`}
                  >
                    {/* Depth Fill Bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none transition-all duration-200"
                      style={{ width: `${depthPct}%` }}
                    />
                    <span className="relative font-bold text-rose-700 group-hover:underline">
                      ₹{a.price.toFixed(2)}
                    </span>
                    <span className="relative text-slate-600 text-[11px]">
                      {a.quantity.toLocaleString()}{" "}
                      <span className="text-slate-400 text-[10px]">({a.orders ?? 1})</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-center font-sans">
          Click any depth level to pre-fill the order price in the ticket.
        </div>
      </CardContent>
    </Card>
  );
}
