"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { AgentAlert } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Zap,
  Play,
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
          <Badge className="bg-rose-600 hover:bg-rose-600 text-white font-mono text-[10px] uppercase">
            {sev}
          </Badge>
        );
      case "MEDIUM":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-mono text-[10px] uppercase">
            {sev}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300 font-mono text-[10px] uppercase">
            {sev || "INFO"}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Demo Trigger */}
      <div className="p-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/60 via-white to-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Autonomous Event-Driven Risk Monitor</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                WebSocket Stream Live
              </Badge>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Continuously evaluates price ticks &amp; position drawdowns on the in-memory Event Bus. Dispatches unprompted Mistral AI risk briefs.
            </p>
          </div>
        </div>

        {/* Demo Trigger Button for Judges */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateDrop}
            disabled={isSimulatingDrop}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs shrink-0"
          >
            {isSimulatingDrop ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Injecting Drop Tick...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Market Drop (-5.5%)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Demo Notice Banner */}
      {demoNotice && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{demoNotice}</span>
          </div>
          <button
            onClick={() => setDemoNotice(null)}
            className="text-amber-700 hover:text-amber-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Threshold Rules Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Condition 1: Sharp Price Drop
          </div>
          <div className="font-bold text-slate-800">Tick Price Drop &gt; 3.0%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Monitors high-speed market depth delta
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Condition 2: Position Drawdown
          </div>
          <div className="font-bold text-slate-800">Unrealized Loss &gt; 5.0%</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Calculated in real time via live MTM
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Anti-Spam &amp; Debounce
          </div>
          <div className="font-bold text-slate-800">60s Cooldown + 2% Re-Trigger</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Prevents redundant alert flood on tick bursts
          </div>
        </div>
      </div>

      {/* Live Stream List */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <CardTitle className="text-xs font-semibold text-slate-800">
              Live Alert Stream
            </CardTitle>
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
              {alerts.length} Total Alerts
            </Badge>
          </div>

          {alerts.length > 0 && (
            <button
              onClick={() => {
                alerts.forEach((a) => dismissAlert(a.id));
              }}
              className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Dismiss All</span>
            </button>
          )}
        </CardHeader>

        <CardContent className="p-5">
          {alerts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="p-3 rounded-full bg-slate-100 text-slate-400 mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <div className="font-semibold text-slate-700 text-sm">
                No Risk Alerts Triggered
              </div>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                The autonomous risk monitor is actively scanning the live event bus.
                Click <strong>“Simulate Market Drop (-5.5%)”</strong> above to test the real-time pipeline live!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors text-xs flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {alert.symbol}
                      </span>
                      {getSeverityBadge(alert.severity)}
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono py-0 px-1.5 text-slate-600 border-slate-300"
                      >
                        {alert.condition || "THRESHOLD BREACH"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-[10px] text-slate-400 hover:text-slate-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {/* AI Risk Brief */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-800 leading-relaxed font-medium">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 mb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Mistral AI Institutional Risk Brief</span>
                    </div>
                    {alert.brief}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
