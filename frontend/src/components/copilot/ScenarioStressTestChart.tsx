"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useTheme } from "@/components/providers/ThemeProvider";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { TrendingDown, TrendingUp, Sliders } from "lucide-react";

interface ScenarioStressTestChartProps {
  symbol: string;
  referencePrice: number;
  shockPct: number;
  quantity: number;
}

export function ScenarioStressTestChart({
  symbol,
  referencePrice,
  shockPct,
  quantity,
}: ScenarioStressTestChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Generate curve from -15% to +15%
  const chartData = useMemo(() => {
    const points = [];
    for (let pct = -15; pct <= 15; pct += 2.5) {
      const price = referencePrice * (1 + pct / 100);
      const pnlDelta = (price - referencePrice) * (quantity || 50);
      points.push({
        shockPct: pct,
        shockLabel: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
        simulatedPrice: Number(price.toFixed(2)),
        simulatedPnl: Number(pnlDelta.toFixed(2)),
      });
    }
    return points;
  }, [referencePrice, quantity]);

  const targetPrice = referencePrice * (1 + shockPct / 100);
  const targetPnl = (targetPrice - referencePrice) * (quantity || 50);

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-500" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
            {symbol} Sensitivity &amp; Stress-Test Curve (-15% to +15%)
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">Shock Target:</span>
          <span
            style={CONTROL_SHADOW_STYLE}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
              targetPnl >= 0
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            }`}
          >
            {shockPct > 0 ? "+" : ""}{shockPct}% (₹{targetPnl.toFixed(2)})
          </span>
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="pnlCurveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="shockLabel"
              stroke={isDark ? "#71717a" : "#94a3b8"}
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: isDark ? "#27272a" : "#e2e8f0" }}
            />
            <YAxis
              stroke={isDark ? "#71717a" : "#94a3b8"}
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: isDark ? "#27272a" : "#e2e8f0" }}
              tickFormatter={(v) => `₹${v}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div
                    style={CONTROL_SHADOW_STYLE}
                    className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#18181b]/95 p-2 text-xs font-mono backdrop-blur-xs"
                  >
                    <div className="text-slate-500 dark:text-zinc-400">
                      Shock Move: {d.shockLabel}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      Price: ₹{d.simulatedPrice.toFixed(2)}
                    </div>
                    <div
                      className={
                        d.simulatedPnl >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"
                      }
                    >
                      P&amp;L Delta: {d.simulatedPnl > 0 ? "+" : ""}₹{d.simulatedPnl.toFixed(2)}
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke={isDark ? "#52525b" : "#cbd5e1"} strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="simulatedPnl"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#pnlCurveGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

