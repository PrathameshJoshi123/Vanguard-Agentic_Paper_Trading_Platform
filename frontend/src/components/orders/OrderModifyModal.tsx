"use client";

import { useState } from "react";
import { Order } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const [newQty, setNewQty] = useState<number>(order ? order.quantity : 1);
  const [newPrice, setNewPrice] = useState<number>(order?.price ? order.price : 100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when order prop changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && order) {
      setNewQty(order.quantity);
      setNewPrice(order.price || 100);
      setErrorMsg(null);
    }
    onOpenChange(isOpen);
  };

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

  const originalTurnover = (order.price || 0) * order.quantity;
  const newTurnover = newPrice * newQty;
  const turnoverDelta = newTurnover - originalTurnover;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-slate-200">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-600" />
              <DialogTitle className="text-slate-900 text-base">
                Modify Resting Order
              </DialogTitle>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] font-bold ${
                order.side === "BUY"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {order.side} {order.symbol}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500 font-mono mt-1">
            Order ID: {order.order_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="modify-qty" className="text-xs font-semibold text-slate-700">
                Quantity (Shares)
              </Label>
              <Input
                id="modify-qty"
                type="number"
                min={order.filled_qty || 1}
                value={newQty}
                onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="font-mono text-sm bg-white"
              />
              <span className="text-[10px] text-slate-400">
                Original: {order.quantity} (Filled: {order.filled_qty})
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modify-price" className="text-xs font-semibold text-slate-700">
                Limit Price (₹)
              </Label>
              <Input
                id="modify-price"
                type="number"
                step="0.05"
                min="0.05"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                className="font-mono text-sm bg-white"
              />
              <span className="text-[10px] text-slate-400">
                Original: ₹{(order.price || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Margin Delta Preview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Order Value Delta:</span>
              <span
                className={`font-mono font-semibold ${
                  turnoverDelta > 0
                    ? "text-blue-700"
                    : turnoverDelta < 0
                    ? "text-emerald-700"
                    : "text-slate-700"
                }`}
              >
                {turnoverDelta > 0 ? "+" : ""}₹{turnoverDelta.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Product Type:</span>
              <span className="font-semibold text-slate-700">
                {order.product_type === "MIS" ? "MIS (20% Leverage)" : "CNC (100% Cash)"}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleModify}
            disabled={isSubmitting}
            className="text-xs bg-slate-900 hover:bg-slate-800 text-white"
          >
            {isSubmitting ? (
              <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
            ) : null}
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
