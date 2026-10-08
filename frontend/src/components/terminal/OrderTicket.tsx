"use client";

import React, { useState, useEffect } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { Side, ProductType, OrderType, OrderPlacementResponse } from "@/lib/types";
import { ChargesPreview } from "./ChargesPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Loader2, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";

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
        const fillMsg =
          res.order.status === "FILLED"
            ? `Filled ${res.order.filled_qty} shares @ ₹${(isNaN(avgFill) ? numPrice : avgFill).toFixed(2)}.`
            : `Order ${res.order.status} (${res.order.remaining_qty} resting on book).`;

        const totalCharges = Number(res.total_charges || 0);
        setExecutionResult({
          type: "SUCCESS",
          message: `${side} Order Executed (${res.order.status})`,
          details: `${fillMsg} ${tradesCount > 0 ? `(${tradesCount} matching trade legs)` : ""}. Regulatory Charges: ₹${(isNaN(totalCharges) ? 0 : totalCharges).toFixed(2)}.`,
        });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to place order.";
      setExecutionResult({
        type: "ERROR",
        message: "Order Rejected",
        details: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-white border-slate-200 shadow-xs">
      <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-slate-700" />
          <CardTitle className="text-sm font-semibold tracking-tight text-slate-800">
            Order Execution Ticket
          </CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-slate-50 border-slate-200">
          {selectedSymbol} • NSE
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <form onSubmit={handleSubmitOrder} className="space-y-4">
          {/* Side Selector: BUY (Emerald) vs SELL (Rose) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSide("BUY")}
              className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                side === "BUY"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setSide("SELL")}
              className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                side === "SELL"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              SELL
            </button>
          </div>

          {/* Product Type Toggle: CNC (Delivery) vs MIS (Intraday) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Product Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProductType("CNC")}
                className={`p-2 border rounded-lg text-left transition-all cursor-pointer ${
                  productType === "CNC"
                    ? "border-blue-600 bg-blue-50/50 text-blue-950 font-bold"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-semibold">CNC (Delivery)</div>
                <div className="text-[10px] text-slate-500 font-sans font-normal">100% Cash Margin</div>
              </button>

              <button
                type="button"
                onClick={() => setProductType("MIS")}
                className={`p-2 border rounded-lg text-left transition-all cursor-pointer ${
                  productType === "MIS"
                    ? "border-blue-600 bg-blue-50/50 text-blue-950 font-bold"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="text-xs font-semibold">MIS (Intraday)</div>
                <div className="text-[10px] text-slate-500 font-sans font-normal">20% Margin (5x Lev.)</div>
              </button>
            </div>
          </div>

          {/* Order Type Tabs: MARKET | LIMIT | SL | SL_M */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Order Type</Label>
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-lg text-[11px] font-mono">
              {(["MARKET", "LIMIT", "SL", "SL_M"] as OrderType[]).map((ot) => (
                <button
                  key={ot}
                  type="button"
                  onClick={() => setOrderType(ot)}
                  className={`py-1 rounded text-center transition-all cursor-pointer ${
                    orderType === ot
                      ? "bg-white text-slate-900 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {ot}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity Input + Quick Lot Helpers */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-slate-700">Quantity (Shares)</Label>
              <div className="flex gap-1">
                {[25, 50, 100].map((lot) => (
                  <button
                    key={lot}
                    type="button"
                    onClick={() => handleQuickQty(lot)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-mono transition-colors cursor-pointer"
                  >
                    +{lot}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
              className="font-mono text-sm h-9 bg-white border-slate-200"
            />
          </div>

          {/* Limit Price Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-slate-700">Limit Price (₹)</Label>
              <button
                type="button"
                onClick={() => setPrice(ltp.toFixed(2))}
                className="text-[10px] text-blue-600 hover:underline font-sans cursor-pointer"
              >
                Use LTP (₹{ltp.toFixed(2)})
              </button>
            </div>
            <Input
              type="number"
              step="0.05"
              disabled={orderType === "MARKET" || orderType === "SL_M"}
              value={orderType === "MARKET" || orderType === "SL_M" ? ltp.toFixed(2) : price}
              onChange={(e) => setPrice(e.target.value)}
              className="font-mono text-sm h-9 bg-white border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {/* Trigger Price (Visible only for SL / SL_M) */}
          {(orderType === "SL" || orderType === "SL_M") && (
            <div className="space-y-1.5 animate-fadeIn">
              <Label className="text-xs font-semibold text-slate-700">Trigger Price (₹)</Label>
              <Input
                type="number"
                step="0.05"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                className="font-mono text-sm h-9 bg-white border-slate-200"
              />
            </div>
          )}

          {/* Interactive Pre-Trade Charges & Margin Preview */}
          <ChargesPreview
            side={side}
            productType={productType}
            price={orderType === "MARKET" || orderType === "SL_M" ? ltp : numPrice}
            quantity={quantity}
            availableCash={availableCash}
          />

          {/* Execution Feedback Banner */}
          {executionResult && (
            <div
              className={`p-3 rounded-lg text-xs border flex items-start gap-2 ${
                executionResult.type === "SUCCESS"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              {executionResult.type === "SUCCESS" ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              )}
              <div className="space-y-0.5">
                <div className="font-semibold">{executionResult.message}</div>
                {executionResult.details && (
                  <div className="text-[11px] opacity-90">{executionResult.details}</div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 text-xs font-bold tracking-wide uppercase shadow-xs transition-all ${
              side === "BUY"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-rose-600 hover:bg-rose-700 text-white"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Executing Order...
              </span>
            ) : (
              `PLACE ${side} ORDER (${selectedSymbol})`
            )}
          </Button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            Deterministic matching engine • Full double-entry ledger audit
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
