"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CopilotChat } from "@/components/copilot/CopilotChat";
import { WhatIfSandbox } from "@/components/copilot/WhatIfSandbox";
import { ProactiveAlertFeed } from "@/components/copilot/ProactiveAlertFeed";
import { Bot, FlaskConical, Bell, Shield, Sparkles } from "lucide-react";

export default function CopilotPage() {
  const alerts = useTradingStore((s) => s.alerts);
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Agentic AI Copilot &amp; Intelligence Plane
              </h1>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                Mistral AI + LangGraph
              </Badge>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Decoupled Intelligence Plane: Read-Only Tool Gateways • Policy Firewall • What-If Simulation
            </div>
          </div>
        </div>

        {/* Global Safeguard Badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 flex items-center gap-1.5 py-1">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Policy Firewall Active</span>
          </Badge>

          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-300 flex items-center gap-1.5 py-1 font-mono">
            <span>Max ₹50k / Loss ₹2k</span>
          </Badge>
        </div>
      </div>

      {/* Full-Width Institutional Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-auto">
          <TabsTrigger
            value="chat"
            className="flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span>Conversational Copilot</span>
          </TabsTrigger>

          <TabsTrigger
            value="sandbox"
            className="flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
            <span>What-If Scenario Sandbox</span>
          </TabsTrigger>

          <TabsTrigger
            value="alerts"
            className="flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span>Proactive Risk Alerts</span>
            {alerts.length > 0 && (
              <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0 rounded-full font-mono">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Conversational Copilot & Research */}
        <TabsContent value="chat" className="mt-0 focus-visible:outline-none">
          <CopilotChat />
        </TabsContent>

        {/* Tab 2: What-If Scenario Sandbox */}
        <TabsContent value="sandbox" className="mt-0 focus-visible:outline-none">
          <WhatIfSandbox />
        </TabsContent>

        {/* Tab 3: Proactive Alert Stream */}
        <TabsContent value="alerts" className="mt-0 focus-visible:outline-none">
          <ProactiveAlertFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}
