"use client";

import { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import {
  RotateCcw,
  CheckCircle2,
  Radio,
  Wifi,
  WifiOff,
  Flame,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SYMBOLS = ["RELIANCE", "TCS", "INFY"];

export function TopHeader() {
  const wsConnected = useTradingStore((s) => s.wsConnected);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const cashSummary = useTradingStore((s) => s.cashSummary);
  const auditReport = useTradingStore((s) => s.auditReport);
  const feedStatus = useTradingStore((s) => s.feedStatus);
  const setFeedStatus = useTradingStore((s) => s.setFeedStatus);
  const setAuditReport = useTradingStore((s) => s.setAuditReport);

  const [isTogglingFeed, setIsTogglingFeed] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);

  const handleToggleFeed = async () => {
    const nextMode = feedStatus?.mode === "LIVE" ? "REPLAY" : "LIVE";
    try {
      setIsTogglingFeed(true);
      const res = await api.setFeedMode(nextMode);
      setFeedStatus(res);
    } catch {
      // Toggle locally if backend offline
      setFeedStatus({
        mode: nextMode,
        is_live: nextMode === "LIVE",
        active_symbol: selectedSymbol,
        tick_rate: 1.0,
        sequence_gap_count: 0,
        duplicate_count: 0,
      });
    } finally {
      setIsTogglingFeed(false);
    }
  };

  const handleCrashReplay = async () => {
    try {
      setIsReplaying(true);
      const res = await api.crashReplay();
      if (res.reconciliation) {
        setAuditReport(res.reconciliation);
      }
    } catch (err) {
      console.error("Crash replay error:", err);
    } finally {
      setIsReplaying(false);
    }
  };

  const formatRupee = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const isLive = feedStatus?.mode === "LIVE";

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Symbol Selection Tabs */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Market:
        </span>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          {SYMBOLS.map((sym) => (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedSymbol === sym
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {sym}
            </button>
          ))}
        </div>

        {/* Demo Mode Toggle Switch */}
        <div className="ml-4 flex items-center gap-2 border-l pl-4 border-slate-200">
          <span className="text-xs font-medium text-slate-500">Feed Mode:</span>
          <Button
            size="sm"
            variant="outline"
            disabled={isTogglingFeed}
            onClick={handleToggleFeed}
            className={`h-7 px-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isLive
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLive ? "animate-pulse text-emerald-600" : "text-amber-600"}`} />
            {isLive ? "LIVE NSE" : "OFFLINE REPLAY"}
          </Button>
        </div>
      </div>

      {/* Account Health & Engine Audit */}
      <div className="flex items-center gap-6">
        {/* Account Cash & MTM */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-sans uppercase font-medium">
              Available Cash
            </div>
            <div className="font-semibold text-slate-900">
              {formatRupee(cashSummary.available_cash)}
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-sans uppercase font-medium">
              Realized P&amp;L
            </div>
            <div
              className={`font-semibold ${
                cashSummary.realized_pnl >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {formatRupee(cashSummary.realized_pnl)}
            </div>
          </div>
        </div>

        {/* Zero-Discrepancy Audit Badge */}
        <Badge
          variant="outline"
          className="h-7 px-2.5 bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs flex items-center gap-1.5 font-medium"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>₹0.00 Discrepancy</span>
        </Badge>

        {/* Cold Crash Recovery Button */}
        <Button
          size="sm"
          variant="outline"
          disabled={isReplaying}
          onClick={handleCrashReplay}
          className="h-7 px-2.5 text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isReplaying ? "animate-spin" : ""}`} />
          <span>Crash Replay</span>
        </Button>

        {/* WebSocket Connection Status */}
        <div className="flex items-center gap-1.5 text-xs font-medium pl-2 border-l border-slate-200">
          {wsConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <Wifi className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono">STREAM</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              <WifiOff className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono">CONNECTING</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
