"use client";

import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Layers, ShoppingBag, ShieldAlert } from "lucide-react";

export default function TradingTerminalPage() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);
  const ltp = marketDepth?.ltp || 1175.70;

  return (
    <div className="space-y-6">
      {/* Page Title & Live Ticker Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Trading Terminal
          </h1>
          <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5 bg-white border-slate-300">
            {selectedSymbol}
          </Badge>
          <div className="flex items-center gap-2 font-mono text-sm">
            <span className="text-xs text-slate-500 font-sans">LTP:</span>
            <span className="font-bold text-slate-900">
              ₹{ltp.toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              +0.85%
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          NSE Equities Cash (CNC) &amp; Intraday (MIS)
        </div>
      </div>

      {/* Grid Layout for Terminal (Scaffold for Phase 7C) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Price Chart & Depth Book (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Chart Placeholder Card */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <CardTitle className="text-sm font-semibold">
                  TradingView Price Chart ({selectedSymbol})
                </CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                1-MIN CANDLES
              </Badge>
            </CardHeader>
            <CardContent className="p-6 h-80 flex flex-col items-center justify-center bg-slate-50/50 rounded-b-xl border-dashed border-2 border-slate-200 m-3">
              <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
              <div className="text-sm font-semibold text-slate-700">
                TradingView Lightweight Chart Canvas
              </div>
              <div className="text-xs text-slate-500 max-w-sm text-center mt-1">
                Phase 7C will mount the interactive canvas chart syncing with real-time ticks and OHLCV history.
              </div>
            </CardContent>
          </Card>

          {/* L2 5-Depth Book Placeholder Card */}
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-sm font-semibold">
                  Live 5-Depth Order Book (Level 2)
                </CardTitle>
              </div>
              <div className="text-xs font-mono text-slate-500">
                Spread: ₹0.10
              </div>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-2 gap-4">
              {/* Bids */}
              <div className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Top 5 Bids (Buyers)</span>
                  <span>Qty / Orders</span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between py-1 px-2 rounded bg-emerald-100/50 text-emerald-900 font-semibold">
                    <span>₹1,175.60</span>
                    <span>1,200 (12)</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 text-slate-600">
                    <span>₹1,175.50</span>
                    <span>850 (8)</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 text-slate-600">
                    <span>₹1,175.40</span>
                    <span>2,100 (19)</span>
                  </div>
                </div>
              </div>

              {/* Asks */}
              <div className="border border-rose-100 bg-rose-50/30 rounded-lg p-3">
                <div className="text-xs font-semibold text-rose-800 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Top 5 Asks (Sellers)</span>
                  <span>Qty / Orders</span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between py-1 px-2 rounded bg-rose-100/50 text-rose-900 font-semibold">
                    <span>₹1,175.70</span>
                    <span>950 (9)</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 text-slate-600">
                    <span>₹1,175.80</span>
                    <span>1,400 (14)</span>
                  </div>
                  <div className="flex justify-between py-1 px-2 text-slate-600">
                    <span>₹1,175.90</span>
                    <span>3,200 (22)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Execution Order Ticket (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-slate-700" />
                <CardTitle className="text-sm font-semibold">
                  Order Execution Ticket
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                CNC / MIS
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button className="py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-xs">
                  BUY
                </button>
                <button className="py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                  SELL
                </button>
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800">
                  Pre-Trade Margin &amp; Tax Preview
                </div>
                <div className="flex justify-between">
                  <span>Required Margin (MIS 20%):</span>
                  <span className="font-mono font-semibold text-slate-900">₹2,351.40</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Regulatory Charges:</span>
                  <span className="font-mono font-semibold text-slate-900">₹11.26</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  Deterministic engine checks margin upfront and rejects orders if insufficient cash balance.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
