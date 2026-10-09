"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { MISSquareOffBanner } from "@/components/portfolio/MISSquareOffBanner";
import { PortfolioAllocationChart } from "@/components/portfolio/PortfolioAllocationChart";
import { MetricCard } from "@/components/ui/northstar/MetricCard";
import { NorthstarTabs } from "@/components/ui/northstar/NorthstarTabs";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
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
  const [activeTab, setActiveTab] = useState("positions");

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-xs">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Portfolio &amp; Risk Inventory
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Real-time VWAP, Mark-to-Market exposure, Demat delivery &amp; MIS settlement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshPortfolio}
            disabled={isLoading}
            style={CONTROL_SHADOW_STYLE}
            className="h-8 px-3 rounded-full text-xs font-medium bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync State</span>
          </button>
        </div>
      </div>

      {/* Mandatory 15:20 MIS Square-Off Banner */}
      <MISSquareOffBanner />

      {/* KPI Cards Grid using Northstar MetricCard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Invested Capital"
          badge="CNC Cost"
          value={`₹${totalInvested.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          hint="Demat delivery cost basis"
          icon={<Wallet className="w-3.5 h-3.5 text-slate-400" />}
        />

        <MetricCard
          title="Holdings Value"
          badge={`${holdings.length} Assets`}
          value={`₹${currentHoldingsValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          hint={`${holdings.length} symbols in Demat delivery`}
          icon={<Layers className="w-3.5 h-3.5 text-slate-400" />}
        />

        <MetricCard
          title="Live Unrealized MTM"
          badge="Tick Feed"
          badgeColor={
            totalUnrealizedMtm >= 0
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          }
          value={`${totalUnrealizedMtm > 0 ? "+" : ""}₹${totalUnrealizedMtm.toFixed(2)}`}
          trend={{
            value: totalUnrealizedMtm >= 0 ? "+MTM" : "-MTM",
            isPositive: totalUnrealizedMtm >= 0,
            isNegative: totalUnrealizedMtm < 0,
          }}
          hint="Continuous tick-to-tick revaluation"
          icon={<TrendingUp className="w-3.5 h-3.5 text-slate-400" />}
        />

        <MetricCard
          title="Realized P&L"
          badge="Cash Ledger"
          value={`${totalRealizedPnl > 0 ? "+" : ""}₹${totalRealizedPnl.toFixed(2)}`}
          trend={{
            value: totalRealizedPnl >= 0 ? "+Realized" : "-Realized",
            isPositive: totalRealizedPnl >= 0,
            isNegative: totalRealizedPnl < 0,
          }}
          hint="Settled into customer cash journal"
          icon={<ShieldCheck className="w-3.5 h-3.5 text-slate-400" />}
        />
      </div>

      {/* Recharts Analytics: Asset Allocation & P&L breakdown */}
      <PortfolioAllocationChart holdings={holdings} positions={positions} />

      {/* Main Content Tabs: Positions & Holdings */}
      <div className="space-y-4">
        <NorthstarTabs
          tabs={[
            {
              id: "positions",
              label: "Open Positions",
              count: positions.filter((p) => p.quantity !== 0).length,
            },
            {
              id: "holdings",
              label: "Delivery Holdings",
              count: holdings.length,
            },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "positions" ? (
          <PositionsTable positions={positions} onRefresh={refreshPortfolio} />
        ) : (
          <HoldingsTable holdings={holdings} />
        )}
      </div>
    </div>
  );
}
