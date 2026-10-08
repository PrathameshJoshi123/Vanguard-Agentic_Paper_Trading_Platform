"use client";

import { useEffect, useState, useCallback } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { OpenOrdersTable } from "@/components/orders/OpenOrdersTable";
import { TradeHistoryTable } from "@/components/orders/TradeHistoryTable";
import {
  ListOrdered,
  Activity,
  RefreshCw,
  Clock,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default function OrdersPage() {
  const accountId = useTradingStore((s) => s.accountId);
  const orders = useTradingStore((s) => s.orders);
  const trades = useTradingStore((s) => s.trades);
  const cashSummary = useTradingStore((s) => s.cashSummary);
  const setOrders = useTradingStore((s) => s.setOrders);
  const setTrades = useTradingStore((s) => s.setTrades);

  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <ListOrdered className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Orders &amp; Execution Fills
            </h1>
            <p className="text-xs text-slate-500">
              Deterministic state machine lifecycle, in-line modifications &amp; atomic trade match legs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            onClick={refreshOrdersAndTrades}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Sync Orders
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Resting Book Orders
            </CardTitle>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-xl font-bold font-mono text-slate-900">
              {activeRestingOrders.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Active in matching engine memory
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Completed Trades
            </CardTitle>
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-xl font-bold font-mono text-emerald-600">
              {trades.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Matched atomic trade events
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Blocked Margin
            </CardTitle>
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-xl font-bold font-mono text-slate-900">
              ₹{(cashSummary.blocked_margin || 0).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Reserved for resting orders
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="open" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger
            value="open"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
          >
            Open Orders ({activeRestingOrders.length})
          </TabsTrigger>
          <TabsTrigger
            value="trades"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
          >
            Trade Executions ({trades.length})
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
          >
            All Orders History ({orders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Resting Limit &amp; Stop-Loss Orders
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resting in the in-memory order book waiting for matching market depth
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <OpenOrdersTable
                orders={orders}
                onRefresh={refreshOrdersAndTrades}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trades">
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Execution Trades Log
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atomic match records linking maker, taker, and depth book-walk legs
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <TradeHistoryTable trades={trades} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  All Placed Orders (Historical &amp; Closed)
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete order state machine progression (FILLED, CANCELLED, REJECTED)
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <OpenOrdersTable
                orders={orders}
                onRefresh={refreshOrdersAndTrades}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
