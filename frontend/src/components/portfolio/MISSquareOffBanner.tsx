"use client";

import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, Play, CheckCircle2 } from "lucide-react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  NorthstarModal,
  NorthstarPrimaryButton,
  NorthstarSecondaryButton,
} from "@/components/ui/northstar/NorthstarModal";
import { api } from "@/lib/api";
import { useTradingStore } from "@/store/useTradingStore";

export function MISSquareOffBanner() {
  const [timeLeft, setTimeLeft] = useState<string>("Calculating...");
  const [isSquaringOff, setIsSquaringOff] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const accountId = useTradingStore((s) => s.accountId);
  const setPositions = useTradingStore((s) => s.setPositions);
  const setOrders = useTradingStore((s) => s.setOrders);

  // Compute countdown to 15:20:00 IST
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const istNow = new Date(utcTime + 5.5 * 3600000);

      const target = new Date(istNow);
      target.setHours(15, 20, 0, 0);

      if (istNow.getTime() > target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diffMs = target.getTime() - istNow.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}h ${mins
          .toString()
          .padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleForceSquareOff = async () => {
    setIsSquaringOff(true);
    setResultMessage(null);
    try {
      const results = await api.triggerMISSquareOff(accountId);
      const count = results.length;
      setResultMessage(
        count > 0
          ? `Successfully squared off ${count} MIS position(s) at market.`
          : "No open MIS positions required square-off."
      );

      const updatedPositions = await api.getPositions(accountId);
      setPositions(updatedPositions);
      const updatedOrders = await api.getOrders(accountId);
      setOrders(updatedOrders);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute square-off";
      setResultMessage(`Error: ${msg}`);
    } finally {
      setIsSquaringOff(false);
      setDialogOpen(false);
    }
  };

  return (
    <>
      <div
        style={CONTROL_SHADOW_STYLE}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 tracking-wide uppercase">
                Mandatory MIS Auto Square-Off
              </span>
              <span
                style={CONTROL_SHADOW_STYLE}
                className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-full px-2 py-0.5 font-mono"
              >
                15:20:00 IST
              </span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-0.5">
              Auto-executes closing market orders for all intraday leverage positions. Next window:{" "}
              <span className="font-mono font-semibold text-amber-950 dark:text-amber-200">
                {timeLeft}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {resultMessage && (
            <span className="text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
              {resultMessage}
            </span>
          )}
          <button
            type="button"
            style={CONTROL_SHADOW_STYLE}
            onClick={() => setDialogOpen(true)}
            className="h-8 px-3 rounded-full text-xs font-semibold bg-white dark:bg-[#1c1c1f] text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Play className="w-3 h-3 fill-amber-700 dark:fill-amber-400 text-amber-700 dark:text-amber-400" />
            <span>Force Square-Off</span>
          </button>
        </div>
      </div>

      {/* Northstar Modal Confirmation */}
      <NorthstarModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Simulate 15:20 MIS Square-Off"
        subtitle={`Target Account: ${accountId}`}
        footer={
          <>
            <NorthstarSecondaryButton onClick={() => setDialogOpen(false)}>
              Cancel
            </NorthstarSecondaryButton>
            <NorthstarPrimaryButton
              onClick={handleForceSquareOff}
              disabled={isSquaringOff}
              className="!bg-amber-600 hover:!bg-amber-700 text-white"
            >
              {isSquaringOff ? "Executing..." : "Confirm Square-Off"}
            </NorthstarPrimaryButton>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-400">
          <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              This triggers the deterministic settlement scheduler immediately. All open MIS
              positions will be liquidated at prevailing market depth and posted to the financial
              ledger.
            </span>
          </div>
        </div>
      </NorthstarModal>
    </>
  );
}
