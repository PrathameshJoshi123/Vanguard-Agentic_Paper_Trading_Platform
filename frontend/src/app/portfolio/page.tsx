"use client";

import { useEffect, useState, useCallback } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { MISSquareOffBanner } from "@/components/portfolio/MISSquareOffBanner";
import {
  Briefcase,
  Layers,
  TrendingUp,
  RefreshCw,
  Wallet,
  ShieldCheck,
} from "lucide-react";

export default function PortfolioPage() {
  const accountId = useTradingStore((s) => s.accountId);
  const positions = useTradingStore((s) => s.positions);
  const holdings = useTradingStore((s) => s.holdings);
  const marketDepth = useTradingStore((s) => s.marketDepth);
  const setPositions = useTradingStore((s) => s.setPositions);
  const setHoldings = useTradingStore((s) => s.setHoldings);

  const [isLoading, setIsLoading] = useState(false);

  const refreshPortfolio = useCallback(async () => {
    setIsLoading(true);
    try {
      const [posList, holdList] = await Promise.all([
        api.getPositions(accountId),
        api.getHoldings(accountId),
      ]);
      setPositions(posList);
      setHoldings(holdList);
    } catch (err) {
      console.error("Failed to load portfolio:", err);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, setPositions, setHoldings]);

  useEffect(() => {
    refreshPortfolio();
  }, [refreshPortfolio]);

  // Aggregate stats
  const totalInvested = holdings.reduce((sum, h) => {
    const avg = Number(h.average_buy_price || h.average_price || 0);
    return sum + avg * h.quantity;
  }, 0);

  const currentHoldingsValue = holdings.reduce((sum, h) => {
    const ltp =
      marketDepth[h.symbol]?.ltp ||
      Number(h.average_buy_price || h.average_price || 0);
    return sum + ltp * h.quantity;
  }, 0);

  const totalUnrealizedMtm = positions.reduce((sum, p) => {
    if (p.quantity === 0) return sum + (p.unrealized_pnl || 0);
    const ltp =
      marketDepth[p.symbol]?.ltp || p.last_price || p.average_price || 0;
    const mtm = (ltp - (p.average_price || 0)) * p.quantity;
    return sum + mtm;
  }, 0);

  const totalRealizedPnl = positions.reduce(
    (sum, p) => sum + (p.realized_pnl || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Portfolio &amp; Risk Inventory
            </h1>
            <p className="text-xs text-slate-500">
              Real-time VWAP, Mark-to-Market exposure, Demat delivery &amp; MIS settlement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            onClick={refreshPortfolio}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Sync State
          </Button>
        </div>
      </div>

      {/* Mandatory 15:20 MIS Square-Off Banner */}
      <MISSquareOffBanner />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Invested Capital (CNC)
            </CardTitle>
            <Wallet className="w-3.5 h-3.5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-xl font-bold font-mono text-slate-900">
              ₹{totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Demat delivery cost basis
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Holdings Value
            </CardTitle>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-4">
            <div className="text-xl font-bold font-mono text-slate-900">
              ₹{currentHoldingsValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {holdings.length} symbols in Demat
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Live Unrealized MTM
            </CardTitle>
            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-4">
            <div
              className={`text-xl font-bold font-mono ${
                totalUnrealizedMtm > 0
                  ? "text-emerald-600"
                  : totalUnrealizedMtm < 0
                  ? "text-rose-600"
                  : "text-slate-700"
              }`}
            >
              {totalUnrealizedMtm > 0 ? "+" : ""}
              ₹{totalUnrealizedMtm.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Mark-to-market against tick feed
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Realized P&amp;L
            </CardTitle>
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          </CardHeader>
          <CardContent className="p-4">
            <div
              className={`text-xl font-bold font-mono ${
                totalRealizedPnl > 0
                  ? "text-emerald-600"
                  : totalRealizedPnl < 0
                  ? "text-rose-600"
                  : "text-slate-700"
              }`}
            >
              {totalRealizedPnl > 0 ? "+" : ""}
              ₹{totalRealizedPnl.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Settled into customer cash ledger
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs: Positions & Holdings */}
      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger
            value="positions"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
          >
            Open Positions ({positions.filter((p) => p.quantity !== 0).length})
          </TabsTrigger>
          <TabsTrigger
            value="holdings"
            className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs"
          >
            Delivery Holdings ({holdings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Active Positions &amp; Leveraged Risk
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Positions update tick-by-tick with continuous VWAP and MTM
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <PositionsTable
                positions={positions}
                onRefresh={refreshPortfolio}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holdings">
          <Card className="bg-white border-slate-200 shadow-2xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Demat Delivery Inventory (CNC)
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unleveraged delivery assets held for settlement
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <HoldingsTable holdings={holdings} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
