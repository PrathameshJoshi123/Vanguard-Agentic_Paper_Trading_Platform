"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { Holding, Position } from "@/lib/types";
import { useTheme } from "@/components/providers/ThemeProvider";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { PieChart as PieIcon, BarChart3 } from "lucide-react";

interface PortfolioAllocationChartProps {
  holdings: Holding[];
  positions: Position[];
}

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"];

export function PortfolioAllocationChart({
  holdings,
  positions,
}: PortfolioAllocationChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Build allocation data
  const allocationData = holdings.map((h, idx) => {
    const avg = Number(h.average_buy_price || h.average_price || 0);
    const val = avg * h.quantity;
    return {
      name: h.symbol,
      value: val > 0 ? val : 1000,
      color: COLORS[idx % COLORS.length],
    };
  });

  // If no holdings, provide default dummy for initial display
  const displayAllocation =
    allocationData.length > 0
      ? allocationData
      : [
          { name: "RELIANCE", value: 50000, color: "#3b82f6" },
          { name: "TCS", value: 35000, color: "#8b5cf6" },
          { name: "INFY", value: 15000, color: "#10b981" },
        ];

  // Build PnL by symbol for positions
  const pnlData = positions.map((p) => ({
    symbol: p.symbol,
    pnl: Number(((p.realized_pnl || 0) + (p.unrealized_pnl || 0)).toFixed(2)),
  }));

  const displayPnl =
    pnlData.length > 0
      ? pnlData
      : [
          { symbol: "RELIANCE", pnl: 450.5 },
          { symbol: "TCS", pnl: -120.0 },
          { symbol: "INFY", pnl: 280.0 },
        ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Allocation Pie Chart */}
      <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10 mb-2">
          <div className="flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              Demat Asset Allocation (CNC)
            </h3>
          </div>
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2 py-0.5 text-[10px] font-mono font-medium bg-slate-50 dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
          >
            {displayAllocation.length} Symbols
          </span>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={displayAllocation}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
              >
                {displayAllocation.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div
                      style={CONTROL_SHADOW_STYLE}
                      className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#18181b]/95 p-2 text-xs font-mono backdrop-blur-xs"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.name}:
                      </span>{" "}
                      ₹{item.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-100 dark:border-white/10 text-[11px] font-mono">
          {displayAllocation.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-600 dark:text-zinc-400 font-medium">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Position PnL Distribution Bar Chart */}
      <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10 mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              Net P&amp;L by Position Leg
            </h3>
          </div>
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2 py-0.5 text-[10px] font-mono font-medium bg-slate-50 dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
          >
            Mark-to-Market
          </span>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={displayPnl}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <XAxis
                dataKey="symbol"
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
                  const item = payload[0].payload;
                  return (
                    <div
                      style={CONTROL_SHADOW_STYLE}
                      className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#18181b]/95 p-2 text-xs font-mono backdrop-blur-xs"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">
                        {item.symbol}
                      </div>
                      <div
                        className={
                          item.pnl >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"
                        }
                      >
                        P&amp;L: ₹{item.pnl.toFixed(2)}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="pnl"
                radius={[4, 4, 0, 0]}
                fill="#10b981"
                shape={(props: any) => {
                  const { x, y, width, height, value } = props;
                  const fill = value >= 0 ? "#10b981" : "#f43f5e";
                  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/10 text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
          <span className="text-emerald-600 dark:text-emerald-400">Green: Net Profit</span>
          <span className="text-rose-600 dark:text-rose-400">Red: Net Drawdown</span>
        </div>
      </div>
    </div>
  );
}

