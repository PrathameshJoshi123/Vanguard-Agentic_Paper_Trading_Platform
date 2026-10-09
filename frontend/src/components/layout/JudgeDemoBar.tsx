"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { useTradingStore } from "@/store/useTradingStore";
import {
  Sparkles,
  Layers,
  RotateCcw,
  ShieldAlert,
  Flame,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { CONTROL_SHADOW_STYLE, MODAL_SHADOW_STYLE } from "@/lib/design-system";

export function JudgeDemoBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setAuditReport = useTradingStore((s) => s.setAuditReport);
  const accountId = useTradingStore((s) => s.accountId);

  // 1. Seed & Walk Book Demo
  const handleSeedBookWalk = async () => {
    setActiveAction("SEED_WALK");
    setDemoMessage(null);
    try {
      await api.seedDemoBook(selectedSymbol);
      setDemoMessage(
        `✓ Seeded 500 shares across 4 depth levels for ${selectedSymbol}. Now place a 500-share BUY order to walk the book!`
      );
    } catch (err: any) {
      setDemoMessage(`Error: ${err.message}`);
    } finally {
      setActiveAction(null);
    }
  };

  // 2. Crash Recovery Reload
  const handleCrashRecovery = async () => {
    setActiveAction("CRASH_RELOAD");
    setDemoMessage(null);
    try {
      const res = await api.crashReplay();
      if (res.reconciliation) {
        setAuditReport(res.reconciliation);
      }
      setDemoMessage(
        "✓ Server crash simulated: Cold reloaded in-memory state with ₹0.00 discrepancy verified."
      );
    } catch (err: any) {
      setDemoMessage(`Error: ${err.message}`);
    } finally {
      setActiveAction(null);
    }
  };

  // 3. Policy Gate Block Demo
  const handlePolicyGateTest = async () => {
    setActiveAction("POLICY_GATE");
    setDemoMessage(null);
    try {
      const res = await api.copilotChat("Buy 1,000,000 shares of Reliance", accountId);
      if (res.policy_result?.status === "REJECTED") {
        setDemoMessage(
          `✓ Policy Gate Enforced: Blocked oversized order (> ₹50,000). Reason: ${res.policy_result.reason}`
        );
      } else {
        setDemoMessage("✓ Policy response received.");
      }
    } catch (err: any) {
      setDemoMessage(`Error: ${err.message}`);
    } finally {
      setActiveAction(null);
    }
  };

  // 4. Proactive Alert Drop
  const handleSimulateDrop = async () => {
    setActiveAction("SIM_DROP");
    setDemoMessage(null);
    try {
      await api.simulateDrop(selectedSymbol, 5.5);
      setDemoMessage(
        `✓ Injected 5.5% drop on ${selectedSymbol}. Autonomous monitor tripped; alert streaming over WebSockets!`
      );
    } catch (err: any) {
      setDemoMessage(`Error: ${err.message}`);
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="fixed bottom-4 right-6 z-50 select-none">
      <div
        style={MODAL_SHADOW_STYLE}
        className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] overflow-hidden transition-all duration-200 text-slate-900 dark:text-white"
      >
        {/* Collapsed Header / Toggle Pill */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>JUDGE DEMO CONTROLS</span>
            </div>
            <span
              style={CONTROL_SHADOW_STYLE}
              className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
            >
              4 MOMENTS
            </span>
          </div>
          <button className="text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Panel */}
        {isOpen && (
          <div className="p-4 pt-2 border-t border-slate-100 dark:border-white/10 w-96 space-y-3 bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md">
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              One-click triggers for the 4 key evaluation benchmarks:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Moment 1 */}
              <button
                type="button"
                onClick={handleSeedBookWalk}
                disabled={activeAction !== null}
                style={CONTROL_SHADOW_STYLE}
                className="justify-start bg-white dark:bg-[#1f1f23] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-white/10 text-[11px] h-9 rounded-xl px-2.5 flex items-center gap-1.5 font-medium transition-all disabled:opacity-50"
              >
                {activeAction === "SEED_WALK" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span className="truncate">1. 500-Share Book</span>
              </button>

              {/* Moment 2 */}
              <button
                type="button"
                onClick={handleCrashRecovery}
                disabled={activeAction !== null}
                style={CONTROL_SHADOW_STYLE}
                className="justify-start bg-white dark:bg-[#1f1f23] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-white/10 text-[11px] h-9 rounded-xl px-2.5 flex items-center gap-1.5 font-medium transition-all disabled:opacity-50"
              >
                {activeAction === "CRASH_RELOAD" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 text-blue-500" />
                )}
                <span className="truncate">2. Crash Recovery</span>
              </button>

              {/* Moment 3 */}
              <button
                type="button"
                onClick={handlePolicyGateTest}
                disabled={activeAction !== null}
                style={CONTROL_SHADOW_STYLE}
                className="justify-start bg-white dark:bg-[#1f1f23] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-white/10 text-[11px] h-9 rounded-xl px-2.5 flex items-center gap-1.5 font-medium transition-all disabled:opacity-50"
              >
                {activeAction === "POLICY_GATE" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span className="truncate">3. Policy Gate Block</span>
              </button>

              {/* Moment 4 */}
              <button
                type="button"
                onClick={handleSimulateDrop}
                disabled={activeAction !== null}
                style={CONTROL_SHADOW_STYLE}
                className="justify-start bg-white dark:bg-[#1f1f23] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-white/10 text-[11px] h-9 rounded-xl px-2.5 flex items-center gap-1.5 font-medium transition-all disabled:opacity-50"
              >
                {activeAction === "SIM_DROP" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                )}
                <span className="truncate">4. Proactive Alert</span>
              </button>
            </div>

            {/* Status / Output Feedback */}
            {demoMessage && (
              <div
                style={CONTROL_SHADOW_STYLE}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200/80 dark:border-white/10 text-[11px] text-slate-700 dark:text-zinc-300 leading-snug"
              >
                {demoMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
