"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  Time,
} from "lightweight-charts";
import { useTradingStore } from "@/store/useTradingStore";
import { useTheme } from "@/components/providers/ThemeProvider";
import { api } from "@/lib/api";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { TrendingUp, RefreshCw } from "lucide-react";

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TIMEFRAMES = ["1m", "5m", "15m", "1d"];

export function TradingViewChart() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);
  const wsConnected = useTradingStore((s) => s.wsConnected);
  const { theme } = useTheme();

  const isDark = theme === "dark";

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastBarRef = useRef<CandleData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("1m");

  // Initialize or recreate chart canvas when theme or container changes
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chartBg = isDark ? "#18181b" : "#ffffff";
    const textColor = isDark ? "#a1a1aa" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.04)" : "#f1f5f9";
    const borderColor = isDark ? "rgba(255, 255, 255, 0.08)" : "#e2e8f0";

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: chartBg },
        textColor: textColor,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: borderColor,
      },
      rightPriceScale: {
        borderColor: borderColor,
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      crosshair: {
        vertLine: {
          color: isDark ? "#52525b" : "#94a3b8",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: isDark ? "#52525b" : "#94a3b8",
          width: 1,
          style: 3,
        },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "", // Overlay scale
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle auto-resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isDark]);

  // Load candle history from API
  const loadCandles = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    setIsLoading(true);

    try {
      const res = await api.getCandles(selectedSymbol, timeframe, 80);
      if (res && res.candles && res.candles.length > 0) {
        const formattedCandles: CandleData[] = res.candles.map((c) => ({
          time: (typeof c.time === "number" ? c.time : Math.floor(new Date((c as any).timestamp || (c as any).time || Date.now()).getTime() / 1000)) as Time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
        }));

        // Sort ascending
        formattedCandles.sort((a, b) => (a.time as number) - (b.time as number));

        candleSeriesRef.current.setData(
          formattedCandles.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );

        volumeSeriesRef.current.setData(
          formattedCandles.map((c) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
          }))
        );

        lastBarRef.current = formattedCandles[formattedCandles.length - 1];
        chartRef.current?.timeScale().fitContent();
      }
    } catch {
      // Generate synthetic sample candles if backend offline
      generateSyntheticCandles();
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe]);

  const generateSyntheticCandles = () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const basePrice = selectedSymbol === "RELIANCE" ? 2500 : selectedSymbol === "TCS" ? 3500 : 1600;
    const now = Math.floor(Date.now() / 1000);
    const candles: CandleData[] = [];
    let currentPrice = basePrice;

    for (let i = 60; i >= 0; i--) {
      const time = (now - i * 60) as Time;
      const variation = (Math.random() - 0.48) * 10;
      const open = currentPrice;
      const close = Math.round((open + variation) * 100) / 100;
      const high = Math.round((Math.max(open, close) + Math.random() * 4) * 100) / 100;
      const low = Math.round((Math.min(open, close) - Math.random() * 4) * 100) / 100;
      const volume = Math.floor(Math.random() * 8000) + 1200;

      currentPrice = close;
      candles.push({ time, open, high, low, close, volume });
    }

    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volumeSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
      }))
    );

    lastBarRef.current = candles[candles.length - 1];
    chartRef.current?.timeScale().fitContent();
  };

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  // Real-time tick update to candle
  useEffect(() => {
    if (!marketDepth || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const ltp = marketDepth.ltp;
    if (!ltp || !lastBarRef.current) return;

    const currentLast = lastBarRef.current;
    const updatedHigh = Math.max(currentLast.high, ltp);
    const updatedLow = Math.min(currentLast.low, ltp);
    const updatedBar: CandleData = {
      ...currentLast,
      high: updatedHigh,
      low: updatedLow,
      close: ltp,
      volume: currentLast.volume + 1,
    };

    candleSeriesRef.current.update({
      time: updatedBar.time,
      open: updatedBar.open,
      high: updatedBar.high,
      low: updatedBar.low,
      close: updatedBar.close,
    });

    volumeSeriesRef.current.update({
      time: updatedBar.time,
      value: updatedBar.volume,
      color: updatedBar.close >= updatedBar.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
    });

    lastBarRef.current = updatedBar;
  }, [marketDepth]);

  const ltp = marketDepth?.ltp || 2500.0;

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/10 mb-3">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
            {selectedSymbol} Real-Time Chart
          </span>
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-50 dark:bg-[#1e1e22] text-slate-900 dark:text-white border border-slate-200/80 dark:border-white/10"
          >
            ₹{ltp.toFixed(2)}
          </span>
        </div>

        {/* Timeframe & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                style={CONTROL_SHADOW_STYLE}
                className={`h-7 px-2.5 rounded-full text-[11px] font-medium cursor-pointer transition-all border ${
                  timeframe === tf
                    ? "bg-slate-900 text-white dark:bg-white dark:text-black border-transparent shadow-xs font-semibold"
                    : "bg-white dark:bg-[#1c1c1f] text-slate-600 dark:text-zinc-400 border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327]"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadCandles}
            disabled={isLoading}
            style={CONTROL_SHADOW_STYLE}
            title="Refresh Candles"
            className="w-7 h-7 rounded-full border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full h-[380px]" />
    </div>
  );
}
