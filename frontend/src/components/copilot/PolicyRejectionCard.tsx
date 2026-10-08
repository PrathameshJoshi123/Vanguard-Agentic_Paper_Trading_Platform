"use client";

import React from "react";
import { PolicyCheckResult } from "@/lib/types";
import { ShieldAlert, AlertTriangle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PolicyRejectionCardProps {
  policyResult: PolicyCheckResult;
}

export function PolicyRejectionCard({ policyResult }: PolicyRejectionCardProps) {
  const reason = policyResult.reason || "Order proposal rejected by policy firewall.";

  return (
    <div className="mt-3 p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 text-slate-800 text-xs shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-rose-200/80 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-rose-100 text-rose-700">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-rose-950 flex items-center gap-1.5">
              <span>Safety Policy Firewall Violation</span>
            </div>
            <div className="text-[10px] text-rose-700">
              Autonomous Trade Protection &amp; Risk Guard
            </div>
          </div>
        </div>

        <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-mono text-[10px]">
          BLOCKED
        </Badge>
      </div>

      <div className="flex items-start gap-2 bg-white/80 p-2.5 rounded-lg border border-rose-100">
        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div className="text-rose-900 leading-relaxed font-medium">
          {reason}
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-rose-200/60 flex items-center justify-between text-[11px] text-rose-700">
        <span className="flex items-center gap-1">
          <Lock className="w-3 h-3 text-rose-500" />
          Hard limits: Max Order ₹50,000 | Max Single Loss ₹2,000
        </span>
        <span className="font-mono text-[10px] text-rose-600">Zero Execution Backdoors</span>
      </div>
    </div>
  );
}
