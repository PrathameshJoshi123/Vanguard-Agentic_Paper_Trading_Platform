"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { OpenOrdersTable } from "@/components/orders/OpenOrdersTable";
import { TradeHistoryTable } from "@/components/orders/TradeHistoryTable";
import { OrdersVolumeChart } from "@/components/orders/OrdersVolumeChart";
import { MetricCard } from "@/components/ui/northstar/MetricCard";
import { NorthstarTabs } from "@/components/ui/northstar/NorthstarTabs";
import {
  KanbanRails,
  KanbanColumn,
  KanbanCardItem,
} from "@/components/ui/northstar/KanbanRails";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  ListOrdered,
  RefreshCw,
  Clock,
  CheckCircle2,
  Lock,
  Columns3,
  Table as TableIcon,
} from "lucide-react";

export default function OrdersPage() {
  const accountId = useTradingStore((s) => s.accountId);
  const orders = useTradingStore((s) => s.orders);
  const trades = useTradingStore((s) => s.trades);
  const cashSummary = useTradingStore((s) => s.cashSummary);
  const setOrders = useTradingStore((s) => s.setOrders);
  const setTrades = useTradingStore((s) => s.setTrades);

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("open");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  const refreshOrdersAndTrades = useCallback(async () => {
    setIsLoading(true);
    try {
      const [orderList, tradeList] = await Promise.all([
        api.getOrders(accountId),
        api.getTrades(accountId),
      ]);
      setOrders(orderList);
      setTrades(tradeList);
    } catch (err) {
      console.error("Failed to load orders/trades:", err);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, setOrders, setTrades]);

  useEffect(() => {
    refreshOrdersAndTrades();
  }, [refreshOrdersAndTrades]);

  const activeRestingOrders = orders.filter(
    (o) =>
      o.status === "OPEN" ||
      o.status === "PENDING" ||
      o.status === "TRIGGER_PENDING" ||
      o.status === "PARTIALLY_FILLED"
  );

  // Map orders into Northstar Kanban Columns
  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    const openList: KanbanCardItem[] = [];
    const triggerList: KanbanCardItem[] = [];
    const filledList: KanbanCardItem[] = [];
    const closedList: KanbanCardItem[] = [];

    orders.forEach((o) => {
      const card: KanbanCardItem = {
        id: o.order_id,
        title: `${o.side} ${o.symbol}`,
        subtitle: `${o.order_type} • ${o.product_type}`,
        value: `₹${((Number(o.price) || 2500) * Number(o.quantity || 1)).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
        })}`,
        secondaryValue: `${o.filled_qty || 0}/${o.quantity} shares`,
        temperature:
          o.order_type === "MARKET" ? "hot" : o.order_type === "LIMIT" ? "warm" : "cold",
        timestamp: new Date(o.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        channel: o.product_type === "MIS" ? "MIS" : "TERMINAL",
        avatars: ["S7", "NSE"],
      };

      if (o.status === "OPEN" || o.status === "PENDING" || o.status === "PARTIALLY_FILLED") {
        openList.push(card);
      } else if (o.status === "TRIGGER_PENDING") {
        triggerList.push(card);
      } else if (o.status === "FILLED") {
        filledList.push(card);
      } else {
        closedList.push(card);
      }
    });

    return [
      {
        id: "open",
        title: "RESTING IN BOOK",
        dotColor: "bg-sky-500",
        stageTintHex: "#00B2FF15",
        summaryTotal: `${openList.length} orders`,
        cards: openList,
      },
      {
        id: "trigger",
        title: "TRIGGER PENDING",
        dotColor: "bg-amber-500",
        stageTintHex: "#F59E0B15",
        summaryTotal: `${triggerList.length} triggers`,
        cards: triggerList,
      },
      {
        id: "filled",
        title: "MATCHED & FILLED",
        dotColor: "bg-emerald-500",
        stageTintHex: "#22C55E15",
        summaryTotal: `${filledList.length} fills`,
        cards: filledList,
      },
      {
        id: "closed",
        title: "CANCELLED / CLOSED",
        dotColor: "bg-zinc-500",
        stageTintHex: "#55555515",
        summaryTotal: `${closedList.length} closed`,
        cards: closedList,
      },
    ];
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-xs">
            <ListOrdered className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Orders &amp; Execution Fills
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Deterministic state machine lifecycle, in-line modifications &amp; atomic trade match legs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle Switch */}
          <div
            style={CONTROL_SHADOW_STYLE}
            className="flex p-0.5 rounded-full bg-white dark:bg-[#1c1c1f] border border-slate-200/80 dark:border-transparent"
          >
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Kanban Rails</span>
            </button>
          </div>

          <button
            type="button"
            onClick={refreshOrdersAndTrades}
            disabled={isLoading}
            style={CONTROL_SHADOW_STYLE}
            className="h-8 px-3 rounded-full text-xs font-medium bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync Orders</span>
          </button>
        </div>
      </div>

      {/* KPI Cards using Northstar MetricCard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Resting Book Orders"
          badge="In-Memory RAM"
          value={activeRestingOrders.length}
          hint="Active in matching engine memory"
          icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
        />

        <MetricCard
          title="Completed Trades"
          badge="Atomic Leg Matches"
          badgeColor="text-emerald-700 dark:text-emerald-300"
          value={trades.length}
          trend={{ value: `${trades.length} Fills`, isPositive: true }}
          hint="Matched atomic trade events"
          icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        />

        <MetricCard
          title="Blocked Margin"
          badge="Reserve"
          value={`₹${Number(cashSummary.blocked_margin || 0).toFixed(2)}`}
          hint="Reserved for resting limit orders"
          icon={<Lock className="w-3.5 h-3.5 text-slate-400" />}
        />
      </div>

      {/* Orders Volume & Fill Flow Chart */}
      <OrdersVolumeChart orders={orders} trades={trades} />

      {/* Kanban Rails View OR Tabular View */}
      {viewMode === "kanban" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Order Pipeline &amp; Lifecycle Rails
            </h3>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
              Deterministic progression across stages
            </span>
          </div>
          <KanbanRails columns={kanbanColumns} />
        </div>
      ) : (
        <div className="space-y-4">
          <NorthstarTabs
            tabs={[
              {
                id: "open",
                label: "Open Orders",
                count: activeRestingOrders.length,
              },
              {
                id: "trades",
                label: "Trade Executions",
                count: trades.length,
              },
              {
                id: "all",
                label: "All Orders History",
                count: orders.length,
              },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === "open" && (
            <OpenOrdersTable
              orders={orders}
              onRefresh={refreshOrdersAndTrades}
            />
          )}

          {activeTab === "trades" && <TradeHistoryTable trades={trades} />}

          {activeTab === "all" && (
            <OpenOrdersTable
              orders={orders}
              onRefresh={refreshOrdersAndTrades}
            />
          )}
        </div>
      )}
    </div>
  );
}
