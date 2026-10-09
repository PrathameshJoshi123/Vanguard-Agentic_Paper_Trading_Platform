"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { WhatIfSimulationResult, Side, ProductType } from "@/lib/types";
import { ScenarioStressTestChart } from "./ScenarioStressTestChart";
import { MetricCard } from "@/components/ui/northstar/MetricCard";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  NorthstarInput,
  NorthstarPrimaryButton,
} from "@/components/ui/northstar/NorthstarModal";
import {
  FlaskConical,
  Play,
  Loader2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";

const SCENARIO_PRESETS = [
  "What if TCS falls 6%?",
  "What happens if Reliance drops 8%?",
  "What if INFY rises 5%?",
  "Simulate buying 25 shares of TCS at 3500",
];

export function WhatIfSandbox() {
  const accountId = useTradingStore((s) => s.accountId);
  const positions = useTradingStore((s) => s.positions);
  const cashSummary = useTradingStore((s) => s.cashSummary);
  const marketDepth = useTradingStore((s) => s.marketDepth);

  // Visual Controls State
  const defaultSymbol = positions.length > 0 ? positions[0].symbol : "RELIANCE";
  const [selectedSymbol, setSelectedSymbol] = useState(defaultSymbol);
  const [shockPct, setShockPct] = useState<number>(-5.0);
  const [includeOrder, setIncludeOrder] = useState(false);
  const [orderSide, setOrderSide] = useState<Side>("BUY");
  const [orderQty, setOrderQty] = useState(10);
  const [orderPrice, setOrderPrice] = useState(2500);
  const [orderProduct, setOrderProduct] = useState<ProductType>("CNC");

  // Natural Language input
  const [naturalQuery, setNaturalQuery] = useState("");

  // Simulation execution state
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<WhatIfSimulationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected stock's reference price
  const quote = marketDepth[selectedSymbol];
  const referencePrice = quote?.ltp || 2500;
  const simulatedTargetPrice = Number((referencePrice * (1 + shockPct / 100)).toFixed(2));

  const handleRunSimulation = async (queryOverride?: string) => {
    setIsSimulating(true);
    setErrorMsg(null);

    try {
      const activeQuery = queryOverride !== undefined ? queryOverride : naturalQuery.trim();

      const payload = {
        account_id: accountId,
        scenarios: activeQuery
          ? []
          : [
              {
                symbol: selectedSymbol,
                price_change_pct: shockPct,
                target_price: simulatedTargetPrice,
              },
            ],
        hypothetical_orders:
          !activeQuery && includeOrder
            ? [
                {
                  symbol: selectedSymbol,
                  side: orderSide,
                  quantity: orderQty,
                  price: orderPrice,
                  product_type: orderProduct,
                },
              ]
            : [],
        natural_language_prompt: activeQuery || undefined,
      };

      const res = await api.simulateScenario(payload);
      setResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Simulation failed to execute.");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Banner */}
      <div
        style={CONTROL_SHADOW_STYLE}
        className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 bg-white dark:bg-[#18181b] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>What-If Scenario Sandbox</span>
              <span
                style={CONTROL_SHADOW_STYLE}
                className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[10px] rounded-full px-2 py-0.5 font-mono"
              >
                Zero Live Risk
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Simulate hypothetical market crashes or new trades against cloned account state without mutating live data.
            </p>
          </div>
        </div>

        {/* Account Snapshot Badges */}
        <div className="flex items-center gap-3 text-xs">
          <div
            style={CONTROL_SHADOW_STYLE}
            className="bg-slate-50 dark:bg-[#1c1c1f] px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-transparent"
          >
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
              Available Cash
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              ₹{cashSummary.available_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div
            style={CONTROL_SHADOW_STYLE}
            className="bg-slate-50 dark:bg-[#1c1c1f] px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-transparent"
          >
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
              Open Positions
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {positions.length} Positions
            </span>
          </div>
        </div>
      </div>

      {/* Dual Mode Controls (Visual Shock Builder + Natural Language) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Shock & Scenario Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  Visual Market Shock Builder
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                In-Memory State Cloning
              </span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Symbol Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
                  Target Equity Symbol
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    style={CONTROL_SHADOW_STYLE}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200/80 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-[#1E1E1E] text-slate-900 dark:text-zinc-100 outline-none font-medium"
                  >
                    {positions.map((p) => (
                      <option key={p.symbol} value={p.symbol}>
                        {p.symbol} (Held: {p.quantity} qty)
                      </option>
                    ))}
                    {!positions.some((p) => p.symbol === "RELIANCE") && (
                      <option value="RELIANCE">RELIANCE</option>
                    )}
                    {!positions.some((p) => p.symbol === "TCS") && (
                      <option value="TCS">TCS</option>
                    )}
                    {!positions.some((p) => p.symbol === "INFY") && (
                      <option value="INFY">INFY</option>
                    )}
                  </select>

                  <div
                    style={CONTROL_SHADOW_STYLE}
                    className="px-3 py-2 bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200/80 dark:border-transparent rounded-xl font-mono text-xs text-slate-600 dark:text-zinc-300"
                  >
                    LTP: ₹{referencePrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Shock Percentage Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                    Hypothetical Price Shock (% Move)
                  </label>
                  <span
                    className={`font-mono font-bold text-xs ${
                      shockPct < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : shockPct > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    {shockPct > 0 ? `+${shockPct}%` : `${shockPct}%`} → ₹{simulatedTargetPrice.toFixed(2)}
                  </span>
                </div>

                <input
                  type="range"
                  min="-25"
                  max="25"
                  step="0.5"
                  value={shockPct}
                  onChange={(e) => setShockPct(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg"
                />

                {/* Quick preset buttons */}
                <div className="flex items-center justify-between gap-1.5 mt-2">
                  {[-15, -10, -6, -3, 0, 5, 10].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setShockPct(val)}
                      style={CONTROL_SHADOW_STYLE}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
                        shockPct === val
                          ? "bg-slate-900 text-white dark:bg-white dark:text-black border-transparent font-bold"
                          : "bg-white dark:bg-[#1c1c1f] text-slate-600 dark:text-zinc-400 border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327]"
                      }`}
                    >
                      {val > 0 ? `+${val}%` : `${val}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Hypothetical Order toggle */}
              <div className="pt-2 border-t border-slate-100 dark:border-white/10">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-700 dark:text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    checked={includeOrder}
                    onChange={(e) => setIncludeOrder(e.target.checked)}
                    className="rounded border-slate-300 dark:border-zinc-700 text-indigo-600"
                  />
                  <span>Simulate additional hypothetical order leg</span>
                </label>

                {includeOrder && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#141417] border border-slate-200/80 dark:border-white/10">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Side</span>
                      <select
                        value={orderSide}
                        onChange={(e) => setOrderSide(e.target.value as Side)}
                        className="w-full px-2 py-1 text-xs border border-slate-200/80 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#1e1e22] text-slate-900 dark:text-white mt-1"
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        value={orderQty}
                        onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1 text-xs border border-slate-200/80 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#1e1e22] text-slate-900 dark:text-white mt-1 font-mono"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Price</span>
                      <input
                        type="number"
                        min="1"
                        value={orderPrice}
                        onChange={(e) => setOrderPrice(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full px-2 py-1 text-xs border border-slate-200/80 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#1e1e22] text-slate-900 dark:text-white mt-1 font-mono"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">Product</span>
                      <select
                        value={orderProduct}
                        onChange={(e) => setOrderProduct(e.target.value as ProductType)}
                        className="w-full px-2 py-1 text-xs border border-slate-200/80 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#1e1e22] text-slate-900 dark:text-white mt-1"
                      >
                        <option value="CNC">CNC (100%)</option>
                        <option value="MIS">MIS (5x)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Visual Scenario */}
              <NorthstarPrimaryButton
                onClick={() => handleRunSimulation("")}
                disabled={isSimulating}
                className="w-full !h-10 !bg-indigo-600 hover:!bg-indigo-700 text-white"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    <span>Running Financial Simulation Engine...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current mr-1.5" />
                    <span>Run Visual What-If Shock Simulation</span>
                  </>
                )}
              </NorthstarPrimaryButton>
            </div>
          </div>
        </div>

        {/* Right Column: Natural Language Prompt Sandbox (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-5 shadow-xs h-full flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  Natural Language Query Mode
                </h3>
              </div>
              <span
                style={CONTROL_SHADOW_STYLE}
                className="text-[10px] font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-full px-2 py-0.5"
              >
                REGEX + LLM
              </span>
            </div>

            <div className="space-y-4 text-xs flex-1 flex flex-col justify-between pt-3">
              <div>
                <p className="text-slate-500 dark:text-zinc-400 text-[11px] leading-relaxed mb-3">
                  Ask hypothetical scenarios in plain English. The What-If simulation engine extracts symbol, percentage moves, and hypothetical orders automatically.
                </p>

                {/* Preset Pills */}
                <div className="space-y-1.5 mb-4">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Quick Scenario Presets:
                  </span>
                  {SCENARIO_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNaturalQuery(preset);
                        handleRunSimulation(preset);
                      }}
                      disabled={isSimulating}
                      style={CONTROL_SHADOW_STYLE}
                      className="w-full text-left px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141417] hover:bg-purple-50 dark:hover:bg-purple-950/30 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10 text-xs transition-all flex items-center justify-between group disabled:opacity-50 cursor-pointer"
                    >
                      <span className="truncate">{preset}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-purple-500 shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <NorthstarInput
                  type="text"
                  value={naturalQuery}
                  onChange={(e) => setNaturalQuery(e.target.value)}
                  placeholder="e.g. 'What if Reliance drops 7%?'"
                  className="mb-2"
                />

                <NorthstarPrimaryButton
                  onClick={() => handleRunSimulation()}
                  disabled={!naturalQuery.trim() || isSimulating}
                  className="w-full !h-9 !bg-purple-600 hover:!bg-purple-700 text-white"
                >
                  {isSimulating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Simulate Query</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </NorthstarPrimaryButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Interactive Recharts Sensitivity & Stress-Test Curve */}
      <ScenarioStressTestChart
        symbol={selectedSymbol}
        referencePrice={referencePrice}
        shockPct={shockPct}
        quantity={positions.find((p) => p.symbol === selectedSymbol)?.quantity || 50}
      />

      {/* Simulation Result Presentation */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Executive KPI Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title="Projected P&L Delta"
              badge="MTM Impact"
              badgeColor={result.projected_pnl_delta >= 0 ? "text-emerald-700" : "text-rose-700"}
              value={`₹${result.projected_pnl_delta >= 0 ? "+" : ""}${Number(
                result.projected_pnl_delta
              ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              trend={{
                value: `Baseline: ₹${Number(result.current_total_unrealized_pnl).toFixed(2)}`,
                isPositive: result.projected_pnl_delta >= 0,
                isNegative: result.projected_pnl_delta < 0,
              }}
              hint={`Projected total MTM: ₹${Number(result.projected_total_unrealized_pnl).toFixed(2)}`}
              icon={
                result.projected_pnl_delta >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                )
              }
            />

            <MetricCard
              title="Projected Margin Utilized"
              badge="Reserve"
              value={`₹${Number(result.projected_margin_utilized).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}`}
              hint={`Current utilized: ₹${Number(result.current_margin_utilized).toFixed(2)}`}
            />

            <MetricCard
              title="Projected Charges"
              badge="Statutory"
              value={`₹${Number(result.projected_charges || 0).toFixed(2)}`}
              hint="Brokerage, STT, Exchange, GST"
            />

            <MetricCard
              title="Risk Assessment"
              badge="Solvency"
              value={result.risk_assessment}
              hint="Account buffer remains solvent"
            />
          </div>

          {/* Narrative Summary Callout */}
          <div
            style={CONTROL_SHADOW_STYLE}
            className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5"
          >
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-indigo-900 dark:text-indigo-300 block">
                Simulation Narrative &amp; Findings:
              </span>
              <p className="leading-relaxed font-medium">{result.narrative_summary}</p>
            </div>
          </div>

          {/* Simulated Positions Table */}
          {result.positions && result.positions.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] overflow-hidden shadow-xs">
              <div className="py-3 px-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    Position Impact Breakdown
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                  {result.positions.length} Positions Analyzed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/75 dark:bg-[#1f1f23] text-slate-500 dark:text-zinc-400 font-semibold text-[11px] border-b border-slate-200/80 dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-4">Symbol</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Base Price</th>
                      <th className="py-2.5 px-3 text-right">Simulated Price</th>
                      <th className="py-2.5 px-3 text-right">Price Move</th>
                      <th className="py-2.5 px-3 text-right">Current P&amp;L</th>
                      <th className="py-2.5 px-3 text-right">Projected P&amp;L</th>
                      <th className="py-2.5 px-4 text-right">P&amp;L Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {result.positions.map((pos, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                          {pos.symbol}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            style={CONTROL_SHADOW_STYLE}
                            className="rounded-full px-2 py-0.5 text-[10px] font-mono border border-slate-200/80 dark:border-white/10"
                          >
                            {pos.product_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right">{pos.quantity}</td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-600 dark:text-zinc-400">
                          ₹{Number(pos.current_price).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-900 dark:text-white font-semibold">
                          ₹{Number(pos.simulated_price).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right">
                          <span
                            className={`text-[11px] font-semibold ${
                              Number(pos.price_change_pct) < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : Number(pos.price_change_pct) > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-500"
                            }`}
                          >
                            {Number(pos.price_change_pct) > 0 ? "+" : ""}
                            {Number(pos.price_change_pct).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-600 dark:text-zinc-400">
                          ₹{Number(pos.current_unrealized_pnl).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right font-semibold text-slate-900 dark:text-white">
                          ₹{Number(pos.projected_unrealized_pnl).toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono font-bold ${
                            Number(pos.pnl_delta) >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          ₹{Number(pos.pnl_delta) >= 0 ? "+" : ""}
                          {Number(pos.pnl_delta).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
