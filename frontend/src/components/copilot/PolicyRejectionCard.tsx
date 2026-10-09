"use client";

import React from "react";
import { PolicyCheckResult } from "@/lib/types";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { ShieldAlert, AlertTriangle, Lock } from "lucide-react";

interface PolicyRejectionCardProps {
  policyResult: PolicyCheckResult;
}

export function PolicyRejectionCard({ policyResult }: PolicyRejectionCardProps) {
  const reason = policyResult.reason || "Order proposal rejected by policy firewall.";

  return (
    <div
      style={CONTROL_SHADOW_STYLE}
      className="mt-3 p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 text-slate-800 dark:text-zinc-200 text-xs shadow-xs"
    >
      <div className="flex items-center justify-between pb-2 border-b border-rose-200/80 dark:border-rose-900/40 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
              <span>Safety Policy Firewall Violation</span>
            </div>
            <div className="text-[10px] text-rose-700 dark:text-rose-400">
              Autonomous Trade Protection &amp; Risk Guard
            </div>
          </div>
        </div>

        <span
          style={CONTROL_SHADOW_STYLE}
          className="bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-mono text-[10px] rounded-full px-2 py-0.5"
        >
          BLOCKED
        </span>
      </div>

      <div
        style={CONTROL_SHADOW_STYLE}
        className="flex items-start gap-2 bg-white/90 dark:bg-[#18181b]/90 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30"
      >
        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        <div className="text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
          {reason}
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-rose-200/60 dark:border-rose-900/30 flex items-center justify-between text-[11px] text-rose-700 dark:text-rose-400">
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3 text-rose-500" />
          Hard limits: Max Order ₹50,000 | Max Single Loss ₹2,000
        </span>
        <span className="font-mono text-[10px] opacity-80">Zero Execution Backdoors</span>
      </div>
    </div>
  );
}
