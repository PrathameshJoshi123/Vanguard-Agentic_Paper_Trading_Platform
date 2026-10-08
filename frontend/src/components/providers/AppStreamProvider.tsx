"use client";

import React, { useEffect } from "react";
import { useWebSocketStream } from "@/hooks/useWebSocketStream";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";

export function AppStreamProvider({ children }: { children: React.ReactNode }) {
  // Initialize persistent WebSocket stream
  useWebSocketStream();

  const setOrders = useTradingStore((s) => s.setOrders);
  const setPositions = useTradingStore((s) => s.setPositions);
  const setCashSummary = useTradingStore((s) => s.setCashSummary);
  const setAuditReport = useTradingStore((s) => s.setAuditReport);
  const setFeedStatus = useTradingStore((s) => s.setFeedStatus);

  // Initial load of account state and feed status from REST
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [ordersData, positionsData, ledgerData, tAccountsData, feedData] =
          await Promise.allSettled([
            api.getOrders(),
            api.getPositions(),
            api.getLedgerSummary(),
            api.getTAccounts(),
            api.getMarketStatus(),
          ]);

        if (ordersData.status === "fulfilled") setOrders(ordersData.value);
        if (positionsData.status === "fulfilled") setPositions(positionsData.value);
        if (ledgerData.status === "fulfilled") {
          setCashSummary({
            cash_balance: ledgerData.value.running_balance,
            available_cash: ledgerData.value.running_balance,
            blocked_margin: 0,
            realized_pnl: 0,
            unrealized_pnl: 0,
          });
        }
        if (tAccountsData.status === "fulfilled") setAuditReport(tAccountsData.value);
        if (feedData.status === "fulfilled") setFeedStatus(feedData.value);
      } catch (err) {
        console.warn("Failed to fetch initial data:", err);
      }
    }

    loadInitialData();
  }, [setOrders, setPositions, setCashSummary, setAuditReport, setFeedStatus]);

  return <>{children}</>;
}
