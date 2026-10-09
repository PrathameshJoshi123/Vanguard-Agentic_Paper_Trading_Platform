"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { TradingViewChart } from "@/components/terminal/TradingViewChart";
import { OrderBookL2 } from "@/components/terminal/OrderBookL2";
import { OrderTicket } from "@/components/terminal/OrderTicket";
import { LiquidityDepthChart } from "@/components/terminal/LiquidityDepthChart";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { ArrowUpRight, ShieldCheck, Activity } from "lucide-react";

export default function TradingTerminalPage() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);

  // Cross-component click-to-trade state
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  const ltp = marketDepth?.ltp || 2500.0;
  const volume = marketDepth?.volume || 500000;

  return (
    <div className="space-y-5">
      {/* Page Title & Live Ticker Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Trading Terminal
          </h1>
          <span
            style={CONTROL_SHADOW_STYLE}
            className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1c1c1f] border border-slate-200/80 dark:border-transparent text-slate-800 dark:text-zinc-200"
          >
            {selectedSymbol}
          </span>

          <div
            style={CONTROL_SHADOW_STYLE}
            className="flex items-center gap-2 font-mono text-sm bg-white dark:bg-[#1c1c1f] px-3 py-1 rounded-full border border-slate-200/80 dark:border-transparent"
          >
            <span className="text-xs text-slate-400 dark:text-zinc-500 font-sans font-medium">LTP:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              ₹{ltp.toFixed(2)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +0.85%
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-zinc-400 pl-2">
            <span>
              Vol: <strong className="text-slate-700 dark:text-zinc-300">{volume.toLocaleString("en-IN")}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
              <Activity className="w-3 h-3 text-indigo-500 animate-pulse" />
              Tick Stream Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <span
            style={CONTROL_SHADOW_STYLE}
            className="text-[11px] font-mono rounded-full px-2.5 py-0.5 border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300"
          >
            NSE CASH • CNC &amp; MIS
          </span>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Deterministic Fills</span>
          </div>
        </div>
      </div>

      {/* Main Terminal Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): TradingView Chart & Liquidity Depth / Order Book */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. TradingView Lightweight Chart */}
          <TradingViewChart />

          {/* 2. Recharts Cumulative Liquidity Depth Profile */}
          <LiquidityDepthChart />

          {/* 3. Live 5-Depth L2 Order Book with Click-to-Trade */}
          <OrderBookL2 onSelectPrice={(p) => setSelectedPrice(p)} />
        </div>

        {/* Right Column (4 cols): Execution Order Ticket & Regulatory Preview */}
        <div className="lg:col-span-4 space-y-5 sticky top-20">
          <OrderTicket
            selectedPrice={selectedPrice}
            onClearSelectedPrice={() => setSelectedPrice(null)}
          />
        </div>
      </div>
    </div>
  );
}
