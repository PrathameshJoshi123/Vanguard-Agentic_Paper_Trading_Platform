"use client";

import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Shield, Bell, Sparkles } from "lucide-react";

export default function CopilotPage() {
  const alerts = useTradingStore((s) => s.alerts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Agentic AI Copilot &amp; Intelligence Plane
          </h1>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
            Mistral AI + LangGraph
          </Badge>
        </div>
        <div className="text-xs text-slate-500">
          Decoupled Intelligence Plane (Read-Only Tools + Policy Gateway)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chat / Research Area (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="bg-white border-slate-200 shadow-xs h-[520px] flex flex-col justify-between">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <CardTitle className="text-sm font-semibold">
                  Conversational Market Intelligence
                </CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                Policy Guard Active
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 p-6 flex flex-col items-center justify-center text-slate-500 text-sm">
              <Bot className="w-10 h-10 text-slate-300 mb-3" />
              <div className="font-semibold text-slate-700">
                Institutional Research &amp; Trade Proposal Assistant
              </div>
              <div className="text-xs text-slate-400 max-w-md text-center mt-1">
                Ask about market sentiment, stock earnings, or what-if drops. Any proposed order passes through the Policy Gateway before execution.
              </div>
            </CardContent>
            <div className="p-4 border-t border-slate-200 bg-slate-50/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask copilot (e.g. 'What if TCS drops 5%?', 'Research Reliance earnings')..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500"
                />
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                  Send
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Proactive Risk Alerts & Policy Gate (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-sm font-semibold">
                  Safety Policy Gateway
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                FIREWALL
              </Badge>
            </CardHeader>
            <CardContent className="p-4 text-xs space-y-2 text-slate-600">
              <div className="flex justify-between">
                <span>Max Position Value:</span>
                <span className="font-mono font-semibold text-slate-900">₹50,000.00</span>
              </div>
              <div className="flex justify-between">
                <span>Max Single Loss Limit:</span>
                <span className="font-mono font-semibold text-slate-900">₹2,000.00</span>
              </div>
              <div className="flex justify-between">
                <span>Human Approval:</span>
                <span className="text-emerald-700 font-semibold">MANDATORY</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-sm font-semibold">
                  Proactive Risk Alert Stream
                </CardTitle>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {alerts.length} alerts
              </span>
            </CardHeader>
            <CardContent className="p-4 text-xs text-slate-500">
              {alerts.length === 0 ? (
                <p className="text-center py-4">No proactive risk alerts triggered.</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div key={a.id} className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
                      <div className="font-semibold flex justify-between">
                        <span>{a.symbol}</span>
                        <span className="text-[10px] uppercase">{a.severity}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-amber-800">{a.brief}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
