"use client";

import React, { useState, useEffect } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { Side, ProductType, OrderType } from "@/lib/types";
import { ChargesPreview } from "./ChargesPreview";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  NorthstarInput,
  NorthstarPrimaryButton,
  NorthstarSecondaryButton,
} from "@/components/ui/northstar/NorthstarModal";
import {
  ShoppingBag,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Receipt,
  ChevronDown,
} from "lucide-react";

interface OrderTicketProps {
  selectedPrice?: number | null;
  onClearSelectedPrice?: () => void;
}

export function OrderTicket({ selectedPrice, onClearSelectedPrice }: OrderTicketProps) {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const accountId = useTradingStore((s) => s.accountId);
  const availableCash = useTradingStore((s) => s.cashSummary.available_cash);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);
  const addOrUpdateOrder = useTradingStore((s) => s.addOrUpdateOrder);
  const setCashSummary = useTradingStore((s) => s.setCashSummary);
  const cashSummary = useTradingStore((s) => s.cashSummary);

  const ltp = marketDepth?.ltp || 2500.0;

  // Form State
  const [side, setSide] = useState<Side>("BUY");
  const [productType, setProductType] = useState<ProductType>("MIS");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [quantity, setQuantity] = useState<number>(50);
  const [price, setPrice] = useState<string>("2500.00");
  const [triggerPrice, setTriggerPrice] = useState<string>("2495.00");
  const [showCharges, setShowCharges] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<{
    type: "SUCCESS" | "ERROR";
    message: string;
    details?: string;
  } | null>(null);

  // Sync selected price from depth book click
  useEffect(() => {
    if (selectedPrice !== undefined && selectedPrice !== null) {
      setPrice(selectedPrice.toFixed(2));
      if (orderType === "MARKET") {
        setOrderType("LIMIT");
      }
      onClearSelectedPrice?.();
    }
  }, [selectedPrice, orderType, onClearSelectedPrice]);

  const numPrice = parseFloat(price) || ltp;
  const numTriggerPrice = parseFloat(triggerPrice) || ltp;

  const handleQuickQty = (add: number) => {
    setQuantity((prev) => Math.max(1, (prev || 0) + add));
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) return;

    setIsSubmitting(true);
    setExecutionResult(null);

    try {
      const payload = {
        account_id: accountId,
        symbol: selectedSymbol,
        side,
        order_type: orderType,
        product_type: productType,
        quantity,
        price: orderType === "LIMIT" || orderType === "SL" ? numPrice : undefined,
        trigger_price: orderType === "SL" || orderType === "SL_M" ? numTriggerPrice : undefined,
      };

      const res = await api.createOrder(payload);

      if (res && res.order) {
        // Add to local state store
        addOrUpdateOrder(res.order);

        // Update balance in store if returned
        if (res.account_balance !== undefined) {
          const numBalance = Number(res.account_balance);
          setCashSummary({
            ...cashSummary,
            cash_balance: numBalance,
            available_cash: Math.max(0, numBalance - cashSummary.blocked_margin),
          });
        }

        const tradesCount = res.trades ? res.trades.length : 0;
        const avgFill = Number(res.order.average_fill_price || numPrice);

        setExecutionResult({
          type: "SUCCESS",
          message: `${side} ${res.order.filled_qty || quantity} ${selectedSymbol} [${res.order.status}]`,
          details:
            res.order.status === "FILLED"
              ? `Matched ${tradesCount} trade leg(s) @ avg ₹${avgFill.toFixed(2)}`
              : `Order placed in book with ID ${res.order.order_id.slice(0, 8)}`,
        });
      }
    } catch (err: any) {
      setExecutionResult({
        type: "ERROR",
        message: "Order Rejected by Engine",
        details: err.message || "Risk verification or margin failure",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
            Order Placement Ticket
          </h3>
        </div>
        <span
          style={CONTROL_SHADOW_STYLE}
          className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-50 dark:bg-[#1e1e22] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
        >
          {selectedSymbol}
        </span>
      </div>

      <form onSubmit={handleSubmitOrder} className="space-y-4">
        {/* BUY / SELL Side Segmented Switch */}
        <div
          style={CONTROL_SHADOW_STYLE}
          className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-[#121215] border border-slate-200/80 dark:border-transparent gap-1"
        >
          <button
            type="button"
            onClick={() => setSide("BUY")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
              side === "BUY"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            BUY / LONG
          </button>
          <button
            type="button"
            onClick={() => setSide("SELL")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
              side === "SELL"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            SELL / SHORT
          </button>
        </div>

        {/* Product Type (MIS vs CNC) */}
        <div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1.5">
            Product Mode
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProductType("MIS")}
              style={CONTROL_SHADOW_STYLE}
              className={`h-8 rounded-xl text-xs font-medium cursor-pointer transition-all border flex items-center justify-center gap-1.5 ${
                productType === "MIS"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-black border-transparent shadow-xs font-semibold"
                  : "bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327]"
              }`}
            >
              <span>MIS (Intraday 5x)</span>
            </button>
            <button
              type="button"
              onClick={() => setProductType("CNC")}
              style={CONTROL_SHADOW_STYLE}
              className={`h-8 rounded-xl text-xs font-medium cursor-pointer transition-all border flex items-center justify-center gap-1.5 ${
                productType === "CNC"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-black border-transparent shadow-xs font-semibold"
                  : "bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327]"
              }`}
            >
              <span>CNC (Delivery 100%)</span>
            </button>
          </div>
        </div>

        {/* Order Type Tabs */}
        <div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1.5">
            Execution Type
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(["LIMIT", "MARKET", "SL", "SL_M"] as OrderType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                style={CONTROL_SHADOW_STYLE}
                className={`h-7 rounded-lg text-[11px] font-medium cursor-pointer transition-all border ${
                  orderType === t
                    ? "bg-slate-900 text-white dark:bg-white dark:text-black border-transparent font-bold shadow-xs"
                    : "bg-white dark:bg-[#1c1c1f] text-slate-600 dark:text-zinc-400 border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity Field */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
            <span>Quantity (Shares)</span>
            <div className="flex items-center gap-1">
              {[10, 25, 50, 100].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQuickQty(q)}
                  className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                >
                  +{q}
                </button>
              ))}
            </div>
          </div>
          <NorthstarInput
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
            placeholder="Qty"
          />
        </div>

        {/* Price Field */}
        {orderType !== "MARKET" && orderType !== "SL_M" && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
              Limit Price (₹)
            </div>
            <NorthstarInput
              type="number"
              step="0.05"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={`₹${ltp.toFixed(2)}`}
            />
          </div>
        )}

        {/* Trigger Price Field */}
        {(orderType === "SL" || orderType === "SL_M") && (
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1">
              Trigger Price (₹)
            </div>
            <NorthstarInput
              type="number"
              step="0.05"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(e.target.value)}
              placeholder="Trigger Price"
            />
          </div>
        )}

        {/* Toggle Detailed Charges Breakdown */}
        <button
          type="button"
          onClick={() => setShowCharges(!showCharges)}
          style={CONTROL_SHADOW_STYLE}
          className="w-full h-8 px-3 rounded-xl border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#232327] transition-all"
        >
          <div className="flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-blue-500" />
            <span>Pre-Trade Margin &amp; Levies</span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              showCharges ? "rotate-180" : ""
            }`}
          />
        </button>

        {showCharges && (
          <ChargesPreview
            side={side}
            productType={productType}
            price={numPrice}
            quantity={quantity}
            availableCash={availableCash}
          />
        )}

        {/* Submit Button */}
        <NorthstarPrimaryButton
          type="submit"
          disabled={isSubmitting}
          className={`w-full h-9 text-xs font-bold ${
            side === "BUY"
              ? "!bg-emerald-600 hover:!bg-emerald-700 text-white"
              : "!bg-rose-600 hover:!bg-rose-700 text-white"
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              Submitting Order...
            </>
          ) : (
            `EXECUTE ${side} ORDER (${quantity} Shares)`
          )}
        </NorthstarPrimaryButton>
      </form>

      {/* Execution Feedback Banner */}
      {executionResult && (
        <div
          style={CONTROL_SHADOW_STYLE}
          className={`p-3 rounded-xl border text-xs ${
            executionResult.type === "SUCCESS"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold">
            {executionResult.type === "SUCCESS" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{executionResult.message}</span>
          </div>
          {executionResult.details && (
            <div className="text-[11px] mt-1 text-slate-600 dark:text-zinc-400 pl-5 font-mono">
              {executionResult.details}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
