"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { CopilotChat } from "@/components/copilot/CopilotChat";
import { WhatIfSandbox } from "@/components/copilot/WhatIfSandbox";
import { ProactiveAlertFeed } from "@/components/copilot/ProactiveAlertFeed";
import { NorthstarTabs } from "@/components/ui/northstar/NorthstarTabs";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { Bot, FlaskConical, Bell, Shield } from "lucide-react";

export default function CopilotPage() {
  const alerts = useTradingStore((s) => s.alerts);
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Agentic AI Copilot &amp; Intelligence Plane
              </h1>
              <span
                style={CONTROL_SHADOW_STYLE}
                className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[10px] rounded-full px-2 py-0.5 font-mono"
              >
                Mistral AI + LangGraph
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Decoupled Intelligence Plane: Read-Only Tool Gateways • Policy Firewall • What-If Simulation
            </div>
          </div>
        </div>

        {/* Global Safeguard Badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span
            style={CONTROL_SHADOW_STYLE}
            className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 py-1 px-3 rounded-full font-medium"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Policy Firewall Active</span>
          </span>

          <span
            style={CONTROL_SHADOW_STYLE}
            className="text-xs bg-white dark:bg-[#1c1c1f] text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent flex items-center gap-1.5 py-1 px-3 rounded-full font-mono"
          >
            <span>Max ₹50k / Loss ₹2k</span>
          </span>
        </div>
      </div>

      {/* Northstar Tabs */}
      <div className="space-y-6">
        <NorthstarTabs
          tabs={[
            {
              id: "chat",
              label: "Conversational Copilot",
              icon: <Bot className="w-3.5 h-3.5 text-indigo-500" />,
            },
            {
              id: "sandbox",
              label: "What-If Scenario Sandbox",
              icon: <FlaskConical className="w-3.5 h-3.5 text-purple-500" />,
            },
            {
              id: "alerts",
              label: "Proactive Risk Alerts",
              count: alerts.length > 0 ? alerts.length : undefined,
              icon: <Bell className="w-3.5 h-3.5 text-amber-500" />,
            },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Tab 1: Conversational Copilot & Research */}
        {activeTab === "chat" && <CopilotChat />}

        {/* Tab 2: What-If Scenario Sandbox */}
        {activeTab === "sandbox" && <WhatIfSandbox />}

        {/* Tab 3: Proactive Alert Stream */}
        {activeTab === "alerts" && <ProactiveAlertFeed />}
      </div>
    </div>
  );
}
