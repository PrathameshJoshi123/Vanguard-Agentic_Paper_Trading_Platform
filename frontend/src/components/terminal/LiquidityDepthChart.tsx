"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTradingStore } from "@/store/useTradingStore";
import { useTheme } from "@/components/providers/ThemeProvider";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { Activity, Layers } from "lucide-react";

export function LiquidityDepthChart() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);
  const { theme } = useTheme();

  const isDark = theme === "dark";

  // Build cumulative depth data
  const chartData = useMemo(() => {
    const defaultPrice =
      selectedSymbol === "TCS"
        ? 2198.0
        : selectedSymbol === "INFY"
        ? 1012.4
        : 1272.5;
    const ltp = Number(marketDepth?.ltp || defaultPrice);

    const rawBids = marketDepth?.bids?.length
      ? [...marketDepth.bids].sort((a, b) => b.price - a.price)
      : [
          { price: Number((ltp - 0.5).toFixed(2)), quantity: 120 },
          { price: Number((ltp - 1.0).toFixed(2)), quantity: 240 },
          { price: Number((ltp - 1.5).toFixed(2)), quantity: 380 },
          { price: Number((ltp - 2.0).toFixed(2)), quantity: 510 },
          { price: Number((ltp - 2.5).toFixed(2)), quantity: 650 },
        ];

    const rawAsks = marketDepth?.asks?.length
      ? [...marketDepth.asks].sort((a, b) => a.price - b.price)
      : [
          { price: Number((ltp + 0.5).toFixed(2)), quantity: 150 },
          { price: Number((ltp + 1.0).toFixed(2)), quantity: 270 },
          { price: Number((ltp + 1.5).toFixed(2)), quantity: 390 },
          { price: Number((ltp + 2.0).toFixed(2)), quantity: 480 },
          { price: Number((ltp + 2.5).toFixed(2)), quantity: 610 },
        ];

    // Cumulative bids (from closest to farthest)
    let bidAcc = 0;
    const bidPoints: Array<{ price: number; bidDepth: number; askDepth?: number }> = [];
    rawBids.forEach((b) => {
      bidAcc += b.quantity;
      bidPoints.unshift({
        price: b.price,
        bidDepth: bidAcc,
      });
    });

    // Cumulative asks
    let askAcc = 0;
    const askPoints: Array<{ price: number; bidDepth?: number; askDepth: number }> = [];
    rawAsks.forEach((a) => {
      askAcc += a.quantity;
      askPoints.push({
        price: a.price,
        askDepth: askAcc,
      });
    });

    return [...bidPoints, ...askPoints];
  }, [marketDepth]);

  const bestBid = Number(marketDepth?.bids?.[0]?.price || 2499.5);
  const bestAsk = Number(marketDepth?.asks?.[0]?.price || 2500.5);
  const spread = (bestAsk - bestBid).toFixed(2);

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
            Cumulative Liquidity Depth Curve
          </h3>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">Spread:</span>
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-slate-50 dark:bg-[#1e1e22] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
          >
            ₹{spread}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 ml-2">Mid:</span>
          <span className="font-bold text-slate-900 dark:text-white">
            ₹{((bestBid + bestAsk) / 2).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="bidDepthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="askDepthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="price"
              tickFormatter={(val) => `₹${val.toFixed(1)}`}
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
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div
                    style={CONTROL_SHADOW_STYLE}
                    className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#18181b]/95 p-2 text-xs font-mono backdrop-blur-xs"
                  >
                    <div className="text-[10px] text-slate-400 dark:text-zinc-400">
                      Price: ₹{data.price?.toFixed(2)}
                    </div>
                    {data.bidDepth !== undefined && (
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                        Cum. Bids: {data.bidDepth.toLocaleString()}
                      </div>
                    )}
                    {data.askDepth !== undefined && (
                      <div className="text-rose-600 dark:text-rose-400 font-bold">
                        Cum. Asks: {data.askDepth.toLocaleString()}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="stepAfter"
              dataKey="bidDepth"
              stroke="#10b981"
              strokeWidth={1.5}
              fill="url(#bidDepthGrad)"
            />
            <Area
              type="stepBefore"
              dataKey="askDepth"
              stroke="#f43f5e"
              strokeWidth={1.5}
              fill="url(#askDepthGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/10 text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Buyer Liquidity Area
        </span>
        <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Seller Liquidity Area
        </span>
      </div>
    </div>
  );
}

