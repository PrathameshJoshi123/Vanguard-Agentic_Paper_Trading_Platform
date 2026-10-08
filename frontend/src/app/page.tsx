"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { TradingViewChart } from "@/components/terminal/TradingViewChart";
import { OrderBookL2 } from "@/components/terminal/OrderBookL2";
import { OrderTicket } from "@/components/terminal/OrderTicket";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ShieldCheck, Activity } from "lucide-react";

export default function TradingTerminalPage() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);
  const wsConnected = useTradingStore((s) => s.wsConnected);

  // Cross-component click-to-trade state
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  const ltp = marketDepth?.ltp || 2500.0;
  const volume = marketDepth?.volume || 500000;

  return (
    <div className="space-y-5">
      {/* Page Title & Live Ticker Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Trading Terminal
          </h1>
          <Badge
            variant="outline"
            className="font-mono text-xs font-bold px-2.5 py-0.5 bg-white border-slate-300 text-slate-800 shadow-2xs"
          >
            {selectedSymbol}
          </Badge>

          <div className="flex items-center gap-2 font-mono text-sm bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
            <span className="text-xs text-slate-400 font-sans font-medium">LTP:</span>
            <span className="font-bold text-slate-900">
              ₹{ltp.toFixed(2)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.2 rounded flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              +0.85%
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-500 pl-2">
            <span>Vol: <strong className="text-slate-700">{volume.toLocaleString()}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-600">
              <Activity className="w-3 h-3 text-blue-600" />
              Tick Stream Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Badge variant="secondary" className="text-[11px] font-mono bg-slate-100 text-slate-700">
            NSE CASH • CNC &amp; MIS
          </Badge>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Deterministic Fills</span>
          </div>
        </div>
      </div>

      {/* Main Terminal Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols): TradingView Chart & 5-Depth Order Book */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. TradingView Lightweight Chart */}
          <TradingViewChart />

          {/* 2. Live 5-Depth L2 Order Book with Click-to-Trade */}
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
