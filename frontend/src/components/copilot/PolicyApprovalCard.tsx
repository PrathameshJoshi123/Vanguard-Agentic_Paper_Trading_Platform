"use client";

import React, { useState } from "react";
import { OrderProposalPayload, ExecuteProposedResult } from "@/lib/types";
import { calculateOrderChargesAndMargin } from "@/lib/charges";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  NorthstarPrimaryButton,
  NorthstarSecondaryButton,
} from "@/components/ui/northstar/NorthstarModal";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Receipt,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface PolicyApprovalCardProps {
  proposal: OrderProposalPayload;
  executionResult?: ExecuteProposedResult | null;
  onApprove: (proposal: OrderProposalPayload) => Promise<void>;
  onReject: () => void;
}

export function PolicyApprovalCard({
  proposal,
  executionResult,
  onApprove,
  onReject,
}: PolicyApprovalCardProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Compute exact statutory charges & margin preview
  const preview = calculateOrderChargesAndMargin(
    proposal.side,
    proposal.product_type,
    proposal.price,
    proposal.quantity
  );

  const handleApprove = async () => {
    setIsExecuting(true);
    try {
      await onApprove(proposal);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onReject();
  };

  return (
    <div
      style={CONTROL_SHADOW_STYLE}
      className="mt-3 p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 bg-white dark:bg-[#18181b] shadow-xs text-xs"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Policy Gate Approval Card</span>
              <Sparkles className="w-3 h-3 text-indigo-500" />
            </div>
            <div className="text-[10px] text-slate-500 dark:text-zinc-400">
              Firewall Checks Passed • Mandatory Human Authorization Required
            </div>
          </div>
        </div>

        <span
          style={CONTROL_SHADOW_STYLE}
          className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono text-[10px] rounded-full px-2 py-0.5"
        >
          POLICY COMPLIANT
        </span>
      </div>

      {/* Proposal Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[#141417] border border-slate-200/80 dark:border-white/10 mb-3">
        <div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Symbol</span>
          <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">{proposal.symbol}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Side &amp; Product</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              style={CONTROL_SHADOW_STYLE}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                proposal.side === "BUY"
                  ? "bg-emerald-600 text-white border-transparent"
                  : "bg-rose-600 text-white border-transparent"
              }`}
            >
              {proposal.side}
            </span>
            <span
              style={CONTROL_SHADOW_STYLE}
              className="text-[10px] py-0.5 px-2 rounded-full font-mono border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#1c1c1f]"
            >
              {proposal.product_type}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Quantity &amp; Type</span>
          <span className="font-semibold font-mono text-slate-800 dark:text-zinc-200">
            {proposal.quantity} <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-sans">({proposal.order_type})</span>
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Est. Order Value</span>
          <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
            ₹{preview.turnover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Itemized Statutory Charges & Margin Breakdown */}
      <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-[#141417] mb-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/10 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
          <span className="flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            Statutory Regulatory Charges &amp; Margin Check
          </span>
          <span className="font-mono text-slate-900 dark:text-white">
            Required Margin: ₹{preview.requiredMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 text-[10px] font-mono">
          <div>
            <span className="text-slate-400 dark:text-zinc-500 block">Brokerage</span>
            <span className="text-slate-700 dark:text-zinc-300">₹{preview.charges.brokerage.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-zinc-500 block">STT</span>
            <span className="text-slate-700 dark:text-zinc-300">₹{preview.charges.stt.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-zinc-500 block">Exchange</span>
            <span className="text-slate-700 dark:text-zinc-300">₹{preview.charges.exchange_turnover.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-zinc-500 block">SEBI</span>
            <span className="text-slate-700 dark:text-zinc-300">₹{preview.charges.sebi_fees.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-zinc-500 block">Stamp Duty</span>
            <span className="text-slate-700 dark:text-zinc-300">₹{preview.charges.stamp_duty.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-zinc-500 block">GST (18%)</span>
            <span className="text-slate-700 dark:text-zinc-300">₹{preview.charges.gst.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/10 flex justify-between items-center text-[10px]">
          <span className="text-slate-500 dark:text-zinc-400">Total Statutory Levies:</span>
          <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">
            ₹{preview.charges.total_charges.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Action Buttons or Execution Status */}
      {executionResult ? (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Order Executed Successfully via Matching Engine</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-emerald-900 dark:text-emerald-300 mt-1">
            <span>Order ID: <strong>{executionResult.order_id}</strong></span>
            <span>Status: <strong className="uppercase">{executionResult.status}</strong></span>
            <span>Filled Qty: <strong>{executionResult.filled_qty} / {proposal.quantity}</strong></span>
            {executionResult.average_fill_price && (
              <span>Avg Fill: <strong>₹{executionResult.average_fill_price}</strong></span>
            )}
          </div>
        </div>
      ) : isDismissed ? (
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#141417] border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-zinc-400 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-slate-400" />
          <span>Trade proposal was dismissed by user.</span>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2 pt-1">
          <NorthstarSecondaryButton onClick={handleDismiss} disabled={isExecuting}>
            Dismiss
          </NorthstarSecondaryButton>

          <NorthstarPrimaryButton
            onClick={handleApprove}
            disabled={isExecuting}
            className="!bg-emerald-600 hover:!bg-emerald-700 text-white"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>Executing on Engine...</span>
              </>
            ) : (
              <>
                <span>Approve &amp; Execute Trade</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </NorthstarPrimaryButton>
        </div>
      )}
    </div>
  );
}
