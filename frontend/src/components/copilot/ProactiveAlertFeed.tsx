"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { AgentAlert } from "@/lib/types";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  NorthstarPrimaryButton,
} from "@/components/ui/northstar/NorthstarModal";
import {
  Bell,
  Zap,
  Loader2,
  Trash2,
  Clock,
  Sparkles,
  Radio,
  CheckCircle2,
} from "lucide-react";

export function ProactiveAlertFeed() {
  const alerts = useTradingStore((s) => s.alerts);
  const dismissAlert = useTradingStore((s) => s.dismissAlert);
  const [isSimulatingDrop, setIsSimulatingDrop] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const handleSimulateDrop = async () => {
    setIsSimulatingDrop(true);
    setDemoNotice(null);

    try {
      const res = await api.simulateDrop("RELIANCE", 5.5);
      setDemoNotice(
        res.message || "Simulated 5.5% drop injected into RELIANCE. Autonomous monitor triggered!"
      );
    } catch (err: any) {
      setDemoNotice(`Failed to simulate drop: ${err.message}`);
    } finally {
      setIsSimulatingDrop(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const sev = severity.toUpperCase();
    switch (sev) {
      case "CRITICAL":
      case "HIGH":
        return (
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase"
          >
            {sev}
          </span>
        );
      case "MEDIUM":
        return (
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase"
          >
            {sev}
          </span>
        );
      default:
        return (
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 uppercase"
          >
            {sev || "INFO"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Demo Trigger */}
      <div
        style={CONTROL_SHADOW_STYLE}
        className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-[#18181b] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Autonomous Event-Driven Risk Monitor</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span
                style={CONTROL_SHADOW_STYLE}
                className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] rounded-full px-2 py-0.5 font-mono"
              >
                WebSocket Stream Live
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Continuously evaluates price ticks &amp; position drawdowns on the in-memory Event Bus. Dispatches unprompted Mistral AI risk briefs.
            </p>
          </div>
        </div>

        {/* Demo Trigger Button for Judges */}
        <div className="flex items-center gap-2">
          <NorthstarPrimaryButton
            onClick={handleSimulateDrop}
            disabled={isSimulatingDrop}
            className="!bg-amber-600 hover:!bg-amber-700 text-white shrink-0"
          >
            {isSimulatingDrop ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>Injecting Drop Tick...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current mr-1.5" />
                <span>Simulate Market Drop (-5.5%)</span>
              </>
            )}
          </NorthstarPrimaryButton>
        </div>
      </div>

      {/* Demo Notice Banner */}
      {demoNotice && (
        <div
          style={CONTROL_SHADOW_STYLE}
          className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-medium">{demoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDemoNotice(null)}
            className="text-amber-700 dark:text-amber-400 hover:text-amber-900 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Threshold Rules Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          style={CONTROL_SHADOW_STYLE}
          className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] text-xs"
        >
          <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
            Condition 1: Sharp Price Drop
          </div>
          <div className="font-bold text-slate-800 dark:text-zinc-200">Tick Price Drop &gt; 3.0%</div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Monitors high-speed market depth delta
          </div>
        </div>

        <div
          style={CONTROL_SHADOW_STYLE}
          className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] text-xs"
        >
          <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
            Condition 2: Position Drawdown
          </div>
          <div className="font-bold text-slate-800 dark:text-zinc-200">Unrealized Loss &gt; 5.0%</div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Calculated in real time via live MTM
          </div>
        </div>

        <div
          style={CONTROL_SHADOW_STYLE}
          className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] text-xs"
        >
          <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
            Anti-Spam &amp; Debounce
          </div>
          <div className="font-bold text-slate-800 dark:text-zinc-200">60s Cooldown + 2% Re-Trigger</div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Prevents redundant alert flood on tick bursts
          </div>
        </div>
      </div>

      {/* Live Stream List */}
      <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] shadow-xs overflow-hidden">
        <div className="py-3 px-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              Live Alert Stream
            </h3>
            <span
              style={CONTROL_SHADOW_STYLE}
              className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300"
            >
              {alerts.length} Total Alerts
            </span>
          </div>

          {alerts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                alerts.forEach((a) => dismissAlert(a.id));
              }}
              style={CONTROL_SHADOW_STYLE}
              className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded-full border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f]"
            >
              <Trash2 className="w-3 h-3" />
              <span>Dismiss All</span>
            </button>
          )}
        </div>

        <div className="p-5">
          {alerts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="p-3 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-zinc-500 mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <div className="font-semibold text-slate-700 dark:text-zinc-300 text-sm">
                No Risk Alerts Triggered
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-md mt-1">
                The autonomous risk monitor is actively scanning the live event bus.
                Click <strong>“Simulate Market Drop (-5.5%)”</strong> above to test the real-time pipeline live!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  style={CONTROL_SHADOW_STYLE}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-[#141417] hover:bg-slate-50 dark:hover:bg-[#1a1a1d] transition-colors text-xs flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                        {alert.symbol}
                      </span>
                      {getSeverityBadge(alert.severity)}
                      <span
                        style={CONTROL_SHADOW_STYLE}
                        className="text-[10px] font-mono py-0.5 px-2 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-white/10 rounded-full"
                      >
                        {alert.condition || "THRESHOLD BREACH"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissAlert(alert.id)}
                        className="text-[10px] text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {/* AI Risk Brief */}
                  <div
                    style={CONTROL_SHADOW_STYLE}
                    className="p-3 rounded-xl bg-white dark:bg-[#18181b] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-zinc-200 leading-relaxed font-medium"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Mistral AI Institutional Risk Brief</span>
                    </div>
                    {alert.brief}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
