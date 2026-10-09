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
  ShieldCheck,
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
  const holdings = useTradingStore((s) => s.holdings);
  const setHoldings = useTradingStore((s) => s.setHoldings);
  const addOrUpdateOrder = useTradingStore((s) => s.addOrUpdateOrder);
  const setCashSummary = useTradingStore((s) => s.setCashSummary);
  const cashSummary = useTradingStore((s) => s.cashSummary);

  // Synchronize holdings from backend on mount and symbol change
  useEffect(() => {
    let isMounted = true;
    api.getHoldings(accountId)
      .then((h) => {
        if (isMounted && Array.isArray(h)) {
          setHoldings(h);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [accountId, setHoldings, selectedSymbol]);

  const currentHolding =
    holdings.find((h) => h.symbol.toUpperCase() === selectedSymbol.toUpperCase())?.quantity || 0;

  const defaultPrice =
    selectedSymbol === "TCS"
      ? 2198.0
      : selectedSymbol === "INFY"
      ? 1012.4
      : 1272.5;

  const ltp = Number(marketDepth?.ltp || defaultPrice);

  // Form State
  const [side, setSide] = useState<Side>("BUY");
  const [productType, setProductType] = useState<ProductType>("MIS");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [quantity, setQuantity] = useState<number>(50);
  const [price, setPrice] = useState<string>(ltp.toFixed(2));
  const [triggerPrice, setTriggerPrice] = useState<string>((ltp * 0.998).toFixed(2));
  const [showCharges, setShowCharges] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<{
    type: "SUCCESS" | "ERROR";
    message: string;
    details?: string;
  } | null>(null);

  // Sync ticket default price when selected symbol changes
  useEffect(() => {
    const symPrice = Number(
      marketDepth?.ltp ||
        (selectedSymbol === "TCS"
          ? 2198.0
          : selectedSymbol === "INFY"
          ? 1012.4
          : 1272.5)
    );
    setPrice(symPrice.toFixed(2));
    setTriggerPrice((symPrice * 0.998).toFixed(2));
  }, [selectedSymbol]);

  // Sync selected price from depth book click
  useEffect(() => {
    if (selectedPrice !== undefined && selectedPrice !== null) {
      setPrice(Number(selectedPrice).toFixed(2));
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

        // Refresh Demat holdings immediately
        api.getHoldings(accountId)
          .then((h) => {
            if (Array.isArray(h)) setHoldings(h);
          })
          .catch(() => {});

        const tradesCount = res.trades ? res.trades.length : 0;
        const avgFill = Number(res.order.average_fill_price || numPrice);

        if (res.order.status === "CANCELLED") {
          setExecutionResult({
            type: "ERROR",
            message: `${side} ${quantity} ${selectedSymbol} [CANCELLED]`,
            details:
              "Market order cancelled (IOC): No opposite resting liquidity in the book. Tip: Use a LIMIT order at the current market price to rest in the book and fill against live ticks.",
          });
        } else if (res.order.status === "FILLED") {
          setExecutionResult({
            type: "SUCCESS",
            message: `${side} ${res.order.filled_qty || quantity} ${selectedSymbol} [FILLED]`,
            details: `Matched ${tradesCount} trade leg(s) @ avg ₹${Number(avgFill).toFixed(2)}`,
          });
        } else {
          setExecutionResult({
            type: "SUCCESS",
            message: `${side} ${quantity} ${selectedSymbol} [${res.order.status}]`,
            details: `Order placed in book with ID ${res.order.order_id.slice(0, 10)}. Resting in queue waiting for match.`,
          });
        }
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
          <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mb-1.5 flex items-center justify-between">
            <span>Product Mode</span>
            {side === "SELL" && (
              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                Holding: <strong className={currentHolding > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>{currentHolding}</strong> shares
              </span>
            )}
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

        {/* System Architecture Rule Guidance: CNC vs MIS Short Selling */}
        {side === "SELL" && productType === "CNC" && currentHolding === 0 && (
          <div className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
            <div className="flex items-start gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>CNC Short Selling Prohibited</span>
            </div>
            <p className="text-[10.5px] leading-relaxed text-amber-800 dark:text-amber-300">
              Delivery selling requires settled shares in your Demat account (0 held). Switch to <strong>MIS</strong> to short sell intraday without owning shares.
            </p>
            <button
              type="button"
              onClick={() => setProductType("MIS")}
              className="text-[10px] font-bold px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              Switch to MIS (Intraday 5x)
            </button>
          </div>
        )}

        {side === "SELL" && productType === "CNC" && currentHolding > 0 && quantity > currentHolding && (
          <div className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Exceeds Demat Holdings</span>
            </div>
            <p className="text-[10.5px] leading-relaxed text-amber-800 dark:text-amber-300">
              You own {currentHolding} shares of {selectedSymbol}, but order is for {quantity} shares.
            </p>
            <button
              type="button"
              onClick={() => setQuantity(currentHolding)}
              className="text-[10px] font-bold px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
            >
              Cap Quantity to {currentHolding} Shares
            </button>
          </div>
        )}

        {side === "SELL" && productType === "MIS" && (
          <div className="p-2 rounded-xl border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/30 text-[11px] text-sky-800 dark:text-sky-300 flex items-start gap-1.5">
            <span className="text-sky-600 dark:text-sky-400 font-bold shrink-0">ℹ</span>
            <p className="text-[10.5px] leading-relaxed">
              <strong>Intraday Short Selling:</strong> Permitted without holdings. Requires 20% margin (5x leverage). Open positions auto-square off at <strong>15:20 IST</strong>.
            </p>
          </div>
        )}

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
              placeholder={`₹${Number(ltp).toFixed(2)}`}
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
            symbol={selectedSymbol}
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
          disabled={isSubmitting || (side === "SELL" && productType === "CNC" && quantity > currentHolding)}
          className={`w-full h-9 text-xs font-bold ${
            side === "SELL" && productType === "CNC" && quantity > currentHolding
              ? "!bg-slate-400 dark:!bg-zinc-700 text-white cursor-not-allowed opacity-70"
              : side === "BUY"
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
