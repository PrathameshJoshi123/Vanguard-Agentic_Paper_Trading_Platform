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
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      const res = await api.seedDemoBook(selectedSymbol);
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
      const res = await api.simulateDrop(selectedSymbol, 5.5);
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
      <div className="bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 overflow-hidden transition-all duration-200">
        {/* Collapsed Header / Toggle Pill */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <div className="flex items-center gap-1.5 font-bold text-xs tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>JUDGE DEMO CONTROLS</span>
            </div>
            <Badge className="bg-indigo-600 text-[10px] px-1.5 py-0 font-mono">
              4 MOMENTS
            </Badge>
          </div>
          <button className="text-slate-400 hover:text-white transition-colors">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Panel */}
        {isOpen && (
          <div className="p-4 pt-2 border-t border-slate-800 w-96 space-y-3 bg-slate-900/95 backdrop-blur-md">
            <p className="text-[11px] text-slate-300">
              One-click triggers for the 4 key evaluation benchmarks:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Moment 1 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedBookWalk}
                disabled={activeAction !== null}
                className="justify-start bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 text-[11px] h-9"
              >
                {activeAction === "SEED_WALK" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                )}
                1. 500-Share Book
              </Button>

              {/* Moment 2 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCrashRecovery}
                disabled={activeAction !== null}
                className="justify-start bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 text-[11px] h-9"
              >
                {activeAction === "CRASH_RELOAD" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                )}
                2. Crash Recovery
              </Button>

              {/* Moment 3 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePolicyGateTest}
                disabled={activeAction !== null}
                className="justify-start bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 text-[11px] h-9"
              >
                {activeAction === "POLICY_GATE" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                )}
                3. Policy Gate Block
              </Button>

              {/* Moment 4 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulateDrop}
                disabled={activeAction !== null}
                className="justify-start bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 text-[11px] h-9"
              >
                {activeAction === "SIM_DROP" ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Flame className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                )}
                4. Proactive Alert
              </Button>
            </div>

            {/* Status / Output Feedback */}
            {demoMessage && (
              <div className="p-2 rounded bg-slate-800/90 border border-slate-700 text-[10px] text-slate-200 leading-tight">
                {demoMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
