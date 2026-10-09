"use client";

import React, { useState } from "react";
import { Order } from "@/lib/types";
import {
  NorthstarModal,
  NorthstarInput,
  NorthstarPrimaryButton,
  NorthstarSecondaryButton,
} from "@/components/ui/northstar/NorthstarModal";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { api } from "@/lib/api";
import { useTradingStore } from "@/store/useTradingStore";
import { Edit3, RefreshCw } from "lucide-react";

interface OrderModifyModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function OrderModifyModal({
  order,
  open,
  onOpenChange,
  onSuccess,
}: OrderModifyModalProps) {
  const accountId = useTradingStore((s) => s.accountId);
  const [newQty, setNewQty] = useState<number>(order ? Number(order.quantity) : 1);
  const [newPrice, setNewPrice] = useState<number>(order?.price ? Number(order.price) : 100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when order prop changes
  React.useEffect(() => {
    if (order) {
      setNewQty(Number(order.quantity));
      setNewPrice(Number(order.price) || 100);
      setErrorMsg(null);
    }
  }, [order]);

  const handleModify = async () => {
    if (!order) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.modifyOrder(
        order.order_id,
        {
          new_quantity: Number(newQty),
          new_price: Number(newPrice),
        },
        accountId
      );
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to modify order";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  const originalTurnover = (Number(order.price) || 0) * Number(order.quantity);
  const newTurnover = newPrice * newQty;
  const turnoverDelta = newTurnover - originalTurnover;

  return (
    <NorthstarModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Modify Resting Order"
      subtitle={`Order ID: ${order.order_id.slice(0, 12)}... • ${order.symbol}`}
      footer={
        <>
          <NorthstarSecondaryButton onClick={() => onOpenChange(false)}>
            Cancel
          </NorthstarSecondaryButton>
          <NorthstarPrimaryButton
            onClick={handleModify}
            disabled={isSubmitting || newQty <= 0 || newPrice <= 0}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Updating...
              </>
            ) : (
              "Confirm Modification"
            )}
          </NorthstarPrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Order Details Badge */}
        <div className="flex items-center justify-between">
          <span
            style={CONTROL_SHADOW_STYLE}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
              order.side === "BUY"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            }`}
          >
            {order.side} {order.symbol} • {order.product_type}
          </span>
          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
            Current: {order.quantity} @ ₹{Number(order.price || 0).toFixed(2)}
          </span>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block mb-1">
              New Quantity
            </label>
            <NorthstarInput
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value) || 0))}
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block mb-1">
              New Limit Price (₹)
            </label>
            <NorthstarInput
              type="number"
              step="0.05"
              min={0.05}
              value={newPrice}
              onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Financial Delta Card */}
        <div
          style={CONTROL_SHADOW_STYLE}
          className="rounded-xl p-3 bg-slate-50 dark:bg-[#141417] border border-slate-200/80 dark:border-white/10 text-xs font-mono space-y-1.5"
        >
          <div className="flex justify-between text-slate-600 dark:text-zinc-400">
            <span>Original Turnover:</span>
            <span>₹{originalTurnover.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-900 dark:text-white font-semibold">
            <span>New Turnover:</span>
            <span>₹{newTurnover.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-zinc-400">
            <span>Margin Difference:</span>
            <span
              className={
                turnoverDelta > 0
                  ? "text-rose-600 dark:text-rose-400 font-bold"
                  : turnoverDelta < 0
                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                  : "text-slate-500"
              }
            >
              {turnoverDelta > 0 ? "+" : ""}₹{turnoverDelta.toFixed(2)}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}
      </div>
    </NorthstarModal>
  );
}
