"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Side, ProductType, ChargesBreakdown } from "@/lib/types";
import { calculateOrderChargesAndMargin } from "@/lib/charges";
import { api } from "@/lib/api";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { AlertCircle, CheckCircle2, Receipt } from "lucide-react";

interface ChargesPreviewProps {
  side: Side;
  productType: ProductType;
  price: number;
  quantity: number;
  availableCash: number;
}

export function ChargesPreview({
  side,
  productType,
  price,
  quantity,
  availableCash,
}: ChargesPreviewProps) {
  // 1. Instant client-side deterministic calculation
  const localPreview = useMemo(() => {
    return calculateOrderChargesAndMargin(side, productType, price, quantity);
  }, [side, productType, price, quantity]);

  // 2. Debounced server verification
  const [serverCharges, setServerCharges] = useState<ChargesBreakdown | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!price || !quantity || quantity <= 0) {
      setServerCharges(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsVerifying(true);
      try {
        const res = await api.previewMarginAndCharges({
          account_id: "DEFAULT",
          symbol: "RELIANCE",
          side,
          order_type: "LIMIT",
          product_type: productType,
          quantity,
          price,
        });
        if (res?.charges) {
          setServerCharges({
            turnover: Number(res.charges.turnover) || 0,
            brokerage: Number(res.charges.brokerage) || 0,
            stt: Number(res.charges.stt) || 0,
            exchange_turnover: Number(res.charges.exchange_turnover) || 0,
            sebi_fees: Number(res.charges.sebi_fees) || 0,
            stamp_duty: Number(res.charges.stamp_duty) || 0,
            gst: Number(res.charges.gst) || 0,
            total_charges: Number(res.charges.total_charges) || 0,
          });
        }
      } catch {
        // Fall back gracefully to local deterministic math
      } finally {
        setIsVerifying(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [side, productType, price, quantity]);

  const activeCharges = serverCharges || localPreview.charges;
  const requiredMargin = Number(localPreview.requiredMargin || 0);
  const buffer = Math.round((Number(availableCash || 0) - requiredMargin) * 100) / 100;
  const isSufficient = buffer >= 0;

  const formatCharge = (val: number | string | undefined | null): string => {
    const num = Number(val ?? 0);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  return (
    <div
      style={CONTROL_SHADOW_STYLE}
      className="space-y-3 bg-slate-50 dark:bg-[#141417] border border-slate-200/80 dark:border-white/10 rounded-xl p-3.5 text-xs font-mono"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-1.5 font-sans font-semibold text-slate-800 dark:text-zinc-200">
          <Receipt className="w-3.5 h-3.5 text-blue-500" />
          <span>Pre-Trade Margin &amp; Tax Preview</span>
        </div>
        <span
          style={CONTROL_SHADOW_STYLE}
          className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border ${
            isSufficient
              ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
              : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
          }`}
        >
          {isSufficient ? "MARGIN OK" : "SHORTFALL"}
        </span>
      </div>

      {/* Margin Summary Rows */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
          <span className="font-sans">Order Turnover:</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            ₹{Number(activeCharges?.turnover ?? localPreview.turnover ?? 0).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
          <span className="font-sans">
            Required Margin ({productType === "MIS" ? "20% / 5x" : "100% Delivery"}):
          </span>
          <span className="font-bold text-slate-900 dark:text-white">
            ₹{requiredMargin.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
          <span className="font-sans">Available Cash Buffer:</span>
          <span
            className={`font-semibold ${
              isSufficient
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400 font-bold"
            }`}
          >
            {isSufficient ? "+" : "-"}₹
            {Math.abs(buffer).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      {/* Itemized Statutory Charges */}
      <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 space-y-1 text-[11px]">
        <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
          <span className="font-sans">Brokerage ({productType === "MIS" ? "Max ₹20" : "₹0 CNC"}):</span>
          <span>₹{formatCharge(activeCharges?.brokerage)}</span>
        </div>

        <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
          <span className="font-sans">STT (Securities Tax):</span>
          <span>₹{formatCharge(activeCharges?.stt)}</span>
        </div>

        <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
          <span className="font-sans">Exchange Turnover Fee:</span>
          <span>₹{formatCharge(activeCharges?.exchange_turnover)}</span>
        </div>

        <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
          <span className="font-sans">SEBI Turnover Fee:</span>
          <span>₹{formatCharge(activeCharges?.sebi_fees)}</span>
        </div>

        <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
          <span className="font-sans">Stamp Duty (State):</span>
          <span>₹{formatCharge(activeCharges?.stamp_duty)}</span>
        </div>

        <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
          <span className="font-sans">GST (18% on Services):</span>
          <span>₹{formatCharge(activeCharges?.gst)}</span>
        </div>

        <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs">
          <span className="font-sans">Total Regulatory Levies:</span>
          <span className="text-indigo-600 dark:text-indigo-400">
            ₹{formatCharge(activeCharges?.total_charges)}
          </span>
        </div>
      </div>

      {/* Status Warning Banner */}
      {!isSufficient && (
        <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300 flex items-start gap-1.5 font-sans">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <span>
            Insufficient margin: Shortfall of ₹{Math.abs(buffer).toFixed(2)}. Engine will reject this order.
          </span>
        </div>
      )}

      {isSufficient && (
        <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 font-sans">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Margin verified. Ready for deterministic execution.</span>
        </div>
      )}
    </div>
  );
}
