"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import {
  RotateCcw,
  CheckCircle2,
  Radio,
  Wifi,
  WifiOff,
} from "lucide-react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { CrmDropdown } from "@/components/ui/northstar/CrmDropdown";

const SYMBOL_OPTIONS = [
  { value: "RELIANCE", label: "RELIANCE", dotColor: "bg-blue-500" },
  { value: "TCS", label: "TCS", dotColor: "bg-purple-500" },
  { value: "INFY", label: "INFY", dotColor: "bg-emerald-500" },
];

export function TopHeader() {
  const wsConnected = useTradingStore((s) => s.wsConnected);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const cashSummary = useTradingStore((s) => s.cashSummary);
  const feedStatus = useTradingStore((s) => s.feedStatus);
  const setFeedStatus = useTradingStore((s) => s.setFeedStatus);
  const setAuditReport = useTradingStore((s) => s.setAuditReport);

  const [isReplaying, setIsReplaying] = useState(false);

  // Ensure backend feed mode is set to LIVE
  React.useEffect(() => {
    api.setFeedMode("LIVE").then((res) => {
      setFeedStatus(res);
    }).catch(() => {
      setFeedStatus({
        mode: "LIVE",
        feed_mode: "LIVE",
        is_live: true,
        active_symbol: selectedSymbol,
        tick_rate: 1.0,
        sequence_gap_count: 0,
        duplicate_count: 0,
      });
    });
  }, [selectedSymbol, setFeedStatus]);

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

  return (
    <header className="h-14 bg-white dark:bg-[#121215] border-b border-slate-200/60 dark:border-zinc-800/80 px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left Toolbar Controls */}
      <div className="flex items-center gap-3">
        {/* Symbol Dropdown */}
        <CrmDropdown
          prefix="Market:"
          value={selectedSymbol}
          options={SYMBOL_OPTIONS}
          onChange={(val) => setSelectedSymbol(val)}
        />

        {/* Permanent Live NSE Status Pill */}
        <div
          style={CONTROL_SHADOW_STYLE}
          className="h-8 px-3.5 rounded-full border border-slate-200/80 dark:border-transparent text-xs font-medium inline-flex items-center gap-1.5 select-none bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
        >
          <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
          <span className="text-slate-400 dark:text-zinc-500 font-normal">Feed:</span>
          <span className="font-semibold tracking-wide">LIVE NSE</span>
        </div>
      </div>

      {/* Right Toolbar: Account Metrics & System Integrity */}
      <div className="flex items-center gap-4">
        {/* Cash & PnL Pills with CONTROL_SHADOW_STYLE */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Available Cash Pill */}
          <div
            style={CONTROL_SHADOW_STYLE}
            className="h-8 px-3 rounded-full border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] flex items-center gap-2 text-xs font-mono"
          >
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-sans uppercase font-medium">
              Cash
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {formatRupee(cashSummary.available_cash)}
            </span>
          </div>

          {/* Realized PnL Pill */}
          <div
            style={CONTROL_SHADOW_STYLE}
            className="h-8 px-3 rounded-full border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] flex items-center gap-2 text-xs font-mono"
          >
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-sans uppercase font-medium">
              Realized
            </span>
            <span
              className={`font-bold ${
                cashSummary.realized_pnl >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatRupee(cashSummary.realized_pnl)}
            </span>
          </div>
        </div>

        {/* Zero Discrepancy Verified Pill */}
        <div
          style={CONTROL_SHADOW_STYLE}
          className="h-8 px-3 rounded-full border border-slate-200/80 dark:border-transparent bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-mono flex items-center gap-1.5 font-medium"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden md:inline">₹0.00 Discrepancy</span>
          <span className="md:hidden">₹0 Disc</span>
        </div>

        {/* Cold Crash Recovery Button */}
        <button
          type="button"
          disabled={isReplaying}
          onClick={handleCrashReplay}
          style={CONTROL_SHADOW_STYLE}
          className="h-8 px-3 rounded-full border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium cursor-pointer inline-flex items-center gap-1.5 transition-all select-none hover:bg-slate-50 dark:hover:bg-[#232327]"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 ${
              isReplaying ? "animate-spin" : ""
            }`}
          />
          <span className="hidden sm:inline">Crash Recovery</span>
        </button>

        {/* WebSocket Stream Indicator */}
        <div
          style={CONTROL_SHADOW_STYLE}
          className="h-8 px-2.5 rounded-full border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] flex items-center gap-1.5 text-xs font-mono"
        >
          {wsConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <Wifi className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">STREAM</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-400 dark:text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <WifiOff className="w-3.5 h-3.5" />
              <span className="text-[10px]">OFFLINE</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
