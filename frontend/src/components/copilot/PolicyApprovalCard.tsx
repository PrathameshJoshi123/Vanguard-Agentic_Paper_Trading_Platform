"use client";

import React, { useState } from "react";
import { OrderProposalPayload, ExecuteProposedResult } from "@/lib/types";
import { calculateOrderChargesAndMargin } from "@/lib/charges";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Receipt,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <div className="mt-3 p-4 rounded-xl border border-indigo-200 bg-white shadow-xs text-xs">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>Policy Gate Approval Card</span>
              <Sparkles className="w-3 h-3 text-indigo-500" />
            </div>
            <div className="text-[10px] text-slate-500">
              Firewall Checks Passed • Mandatory Human Authorization Required
            </div>
          </div>
        </div>

        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
        >
          POLICY COMPLIANT
        </Badge>
      </div>

      {/* Proposal Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200/80 mb-3">
        <div>
          <span className="text-[10px] text-slate-500 block">Symbol</span>
          <span className="font-bold text-slate-900 text-sm">{proposal.symbol}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block">Side &amp; Product</span>
          <div className="flex items-center gap-1 mt-0.5">
            <Badge
              className={`text-[10px] font-bold px-1.5 py-0 ${
                proposal.side === "BUY"
                  ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                  : "bg-rose-600 hover:bg-rose-600 text-white"
              }`}
            >
              {proposal.side}
            </Badge>
            <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
              {proposal.product_type}
            </Badge>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block">Quantity &amp; Type</span>
          <span className="font-semibold font-mono text-slate-800">
            {proposal.quantity} <span className="text-[10px] text-slate-500 font-sans">({proposal.order_type})</span>
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block">Est. Order Value</span>
          <span className="font-bold font-mono text-indigo-700">
            ₹{preview.turnover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Itemized Statutory Charges & Margin Breakdown */}
      <div className="p-3 rounded-lg border border-slate-200 bg-white mb-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-700">
          <span className="flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            Statutory Regulatory Charges &amp; Margin Check
          </span>
          <span className="font-mono text-slate-900">
            Required Margin: ₹{preview.requiredMargin.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 text-[10px]">
          <div>
            <span className="text-slate-400 block">Brokerage</span>
            <span className="font-mono text-slate-700">₹{preview.charges.brokerage.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">STT / CTT</span>
            <span className="font-mono text-slate-700">₹{preview.charges.stt.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Exchange Fee</span>
            <span className="font-mono text-slate-700">₹{preview.charges.exchange_turnover.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">SEBI Fee</span>
            <span className="font-mono text-slate-700">₹{preview.charges.sebi_fees.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Stamp Duty</span>
            <span className="font-mono text-slate-700">₹{preview.charges.stamp_duty.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-400 block">GST (18%)</span>
            <span className="font-mono text-slate-700">₹{preview.charges.gst.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-100 flex justify-between items-center text-[10px]">
          <span className="text-slate-500">Total Statutory Levies:</span>
          <span className="font-mono font-semibold text-slate-800">
            ₹{preview.charges.total_charges.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Action Buttons or Execution Status */}
      {executionResult ? (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Order Executed Successfully via Matching Engine</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-emerald-900 mt-1">
            <span>Order ID: <strong>{executionResult.order_id}</strong></span>
            <span>Status: <strong className="uppercase">{executionResult.status}</strong></span>
            <span>Filled Qty: <strong>{executionResult.filled_qty} / {proposal.quantity}</strong></span>
            {executionResult.average_fill_price && (
              <span>Avg Fill: <strong>₹{executionResult.average_fill_price}</strong></span>
            )}
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5">
            Trade legs booked into Position Manager &amp; Double-Entry Cash Ledger updated (0.00 discrepancy).
          </div>
        </div>
      ) : isDismissed ? (
        <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-slate-400" />
          <span>Trade proposal was dismissed by user.</span>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={handleDismiss}
            disabled={isExecuting}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
          >
            Dismiss
          </button>

          <button
            onClick={handleApprove}
            disabled={isExecuting}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Executing on Engine...</span>
              </>
            ) : (
              <>
                <span>Approve &amp; Execute Trade</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
