"use client";

import React, { useState } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { WhatIfSimulationResult, Side, ProductType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical,
  Play,
  Loader2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Info,
  DollarSign,
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
      <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/50 via-white to-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>What-If Scenario Sandbox</span>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                Zero Live Risk
              </Badge>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate hypothetical market crashes or new trades against cloned account state without mutating live data.
            </p>
          </div>
        </div>

        {/* Account Snapshot Badges */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 block">Available Cash</span>
            <span className="font-mono font-bold text-slate-900">
              ₹{cashSummary.available_cash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-400 block">Active Open Positions</span>
            <span className="font-mono font-bold text-slate-900">
              {positions.length} Positions
            </span>
          </div>
        </div>
      </div>

      {/* Dual Mode Controls (Visual Shock Builder + Natural Language) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Shock & Scenario Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-white border-slate-200 shadow-xs">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <CardTitle className="text-xs font-semibold text-slate-800">
                  Visual Market Shock Builder
                </CardTitle>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                In-Memory State Cloning
              </span>
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-xs">
              {/* Symbol Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1.5">
                  Target Equity Symbol
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500 font-medium"
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
                    {!positions.some((p) => p.symbol === "HDFCBANK") && (
                      <option value="HDFCBANK">HDFCBANK</option>
                    )}
                  </select>

                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-600">
                    LTP: ₹{referencePrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Shock Percentage Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Hypothetical Price Shock (% Move)
                  </label>
                  <span
                    className={`font-mono font-bold text-xs ${
                      shockPct < 0 ? "text-rose-600" : shockPct > 0 ? "text-emerald-600" : "text-slate-600"
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
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />

                {/* Quick preset buttons */}
                <div className="flex items-center justify-between gap-1.5 mt-2">
                  {[-15, -10, -6, -3, 0, 5, 10].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setShockPct(val)}
                      className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                        shockPct === val
                          ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {val > 0 ? `+${val}%` : `${val}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Hypothetical Order toggle */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={includeOrder}
                    onChange={(e) => setIncludeOrder(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Simulate additional hypothetical order leg</span>
                </label>

                {includeOrder && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Side</span>
                      <select
                        value={orderSide}
                        onChange={(e) => setOrderSide(e.target.value as Side)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white mt-1"
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        value={orderQty}
                        onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white mt-1 font-mono"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Price</span>
                      <input
                        type="number"
                        min="1"
                        value={orderPrice}
                        onChange={(e) => setOrderPrice(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white mt-1 font-mono"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Product</span>
                      <select
                        value={orderProduct}
                        onChange={(e) => setOrderProduct(e.target.value as ProductType)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white mt-1"
                      >
                        <option value="CNC">CNC (100%)</option>
                        <option value="MIS">MIS (5x)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Visual Scenario */}
              <button
                onClick={() => handleRunSimulation("")}
                disabled={isSimulating}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Financial Simulation Engine...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Visual What-If Shock Simulation</span>
                  </>
                )}
              </button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Natural Language Prompt Sandbox (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-white border-slate-200 shadow-xs h-full flex flex-col justify-between">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <CardTitle className="text-xs font-semibold text-slate-800">
                  Natural Language Query Mode
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                REGEX + LLM
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-between">
              <div>
                <p className="text-slate-500 text-[11px] leading-relaxed mb-3">
                  Ask hypothetical scenarios in plain English. The What-If simulation engine extracts symbol, percentage moves, and hypothetical orders automatically.
                </p>

                {/* Preset Pills */}
                <div className="space-y-1.5 mb-4">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Quick Scenario Presets:
                  </span>
                  {SCENARIO_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setNaturalQuery(preset);
                        handleRunSimulation(preset);
                      }}
                      disabled={isSimulating}
                      className="w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-purple-50 hover:text-purple-900 border border-slate-200 text-slate-700 text-xs transition-colors flex items-center justify-between group disabled:opacity-50"
                    >
                      <span className="truncate">{preset}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-purple-600 shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={naturalQuery}
                  onChange={(e) => setNaturalQuery(e.target.value)}
                  placeholder="e.g. 'What if Reliance drops 7%?'"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-purple-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 mb-2"
                />

                <button
                  onClick={() => handleRunSimulation()}
                  disabled={!naturalQuery.trim() || isSimulating}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {isSimulating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Simulate Query</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Simulation Result Presentation */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Executive KPI Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Projected P&L Delta */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] text-slate-500 block">Projected MTM P&amp;L Delta</span>
                <div
                  className={`text-xl font-bold font-mono mt-1 flex items-center gap-1.5 ${
                    result.projected_pnl_delta >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {result.projected_pnl_delta >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-rose-600" />
                  )}
                  <span>
                    ₹{result.projected_pnl_delta >= 0 ? "+" : ""}
                    {Number(result.projected_pnl_delta).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Baseline: ₹{Number(result.current_total_unrealized_pnl).toFixed(2)} → Projected: ₹
                  {Number(result.projected_total_unrealized_pnl).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            {/* Projected Margin Utilized */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] text-slate-500 block">Projected Margin Utilized</span>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                  ₹{Number(result.projected_margin_utilized).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Current: ₹{Number(result.current_margin_utilized).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            {/* Projected Regulatory Levies */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] text-slate-500 block">Projected Charges</span>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                  ₹{Number(result.projected_charges || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Brokerage, STT, Exchange, GST
                </div>
              </CardContent>
            </Card>

            {/* Risk Assessment Status */}
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <span className="text-[11px] text-slate-500 block">Risk Assessment</span>
                <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-xs font-mono uppercase ${
                      result.risk_assessment.toLowerCase().includes("high") ||
                      result.risk_assessment.toLowerCase().includes("severe")
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : "bg-emerald-50 text-emerald-700 border-emerald-300"
                    }`}
                  >
                    {result.risk_assessment}
                  </Badge>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Account buffer remains solvent
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Narrative Summary Callout */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-indigo-900 block">Simulation Narrative &amp; Findings:</span>
              <p className="leading-relaxed text-indigo-900 font-medium">{result.narrative_summary}</p>
            </div>
          </div>

          {/* Simulated Positions Table */}
          {result.positions && result.positions.length > 0 && (
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <CardTitle className="text-xs font-semibold text-slate-800">
                    Position Impact Breakdown
                  </CardTitle>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {result.positions.length} Positions Analyzed
                </span>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-medium text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Symbol</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Quantity</th>
                        <th className="py-2.5 px-3">Base Price</th>
                        <th className="py-2.5 px-3">Simulated Price</th>
                        <th className="py-2.5 px-3">Price Move</th>
                        <th className="py-2.5 px-3">Current P&amp;L</th>
                        <th className="py-2.5 px-3">Projected P&amp;L</th>
                        <th className="py-2.5 px-4 text-right">P&amp;L Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.positions.map((pos, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{pos.symbol}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                              {pos.product_type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{pos.quantity}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            ₹{Number(pos.current_price).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-900 font-semibold">
                            ₹{Number(pos.simulated_price).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={`text-[11px] font-semibold ${
                                Number(pos.price_change_pct) < 0
                                  ? "text-rose-600"
                                  : Number(pos.price_change_pct) > 0
                                  ? "text-emerald-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {Number(pos.price_change_pct) > 0 ? "+" : ""}
                              {Number(pos.price_change_pct).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            ₹{Number(pos.current_unrealized_pnl).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                            ₹{Number(pos.projected_unrealized_pnl).toFixed(2)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono font-bold ${
                              Number(pos.pnl_delta) >= 0 ? "text-emerald-600" : "text-rose-600"
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
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
