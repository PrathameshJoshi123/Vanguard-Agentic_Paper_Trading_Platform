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
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Maximize2, RefreshCw } from "lucide-react";

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function TradingViewChart() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const marketDepth = useTradingStore((s) => s.marketDepth[selectedSymbol]);
  const wsConnected = useTradingStore((s) => s.wsConnected);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastBarRef = useRef<CandleData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("1m");

  // Initialize or recreate chart canvas
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#475569",
        fontFamily: "var(--font-sans), system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#e2e8f0",
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      crosshair: {
        vertLine: {
          color: "#94a3b8",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: "#94a3b8",
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
        bottom: 0.0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle container resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !entries[0].contentRect) return;
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Fetch historical candlestick data
  const loadCandleHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getCandles(selectedSymbol, timeframe, 60);
      if (res && res.candles && res.candles.length > 0) {
        const sorted = [...res.candles].sort((a, b) => a.time - b.time);

        const candleData = sorted.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumeData = sorted.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
        }));

        if (candleSeriesRef.current && volumeSeriesRef.current) {
          candleSeriesRef.current.setData(candleData);
          volumeSeriesRef.current.setData(volumeData);
          chartRef.current?.timeScale().fitContent();

          const last = sorted[sorted.length - 1];
          lastBarRef.current = {
            time: last.time as Time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            volume: last.volume,
          };
        }
      }
    } catch (err) {
      console.warn("Failed to fetch historical candles:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    loadCandleHistory();
  }, [loadCandleHistory]);

  // Live streaming tick updates into the chart
  useEffect(() => {
    if (!marketDepth || !marketDepth.ltp || !candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    const ltp = marketDepth.ltp;
    const now = Math.floor(Date.now() / 1000);
    const currentMinute = (now - (now % 60)) as Time;

    if (!lastBarRef.current) {
      const newBar: CandleData = {
        time: currentMinute,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
        volume: 100,
      };
      lastBarRef.current = newBar;
      candleSeriesRef.current.update({
        time: newBar.time,
        open: newBar.open,
        high: newBar.high,
        low: newBar.low,
        close: newBar.close,
      });
      volumeSeriesRef.current.update({
        time: newBar.time,
        value: newBar.volume,
        color: "rgba(16, 185, 129, 0.4)",
      });
      return;
    }

    const lastBar = lastBarRef.current;
    if ((lastBar.time as number) === (currentMinute as number)) {
      // Update ongoing candle
      const updatedBar: CandleData = {
        time: lastBar.time,
        open: lastBar.open,
        high: Math.max(lastBar.high, ltp),
        low: Math.min(lastBar.low, ltp),
        close: ltp,
        volume: lastBar.volume + 10,
      };
      lastBarRef.current = updatedBar;
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
        color:
          updatedBar.close >= updatedBar.open
            ? "rgba(16, 185, 129, 0.4)"
            : "rgba(239, 68, 68, 0.4)",
      });
    } else if ((currentMinute as number) > (lastBar.time as number)) {
      // Minute boundary crossed: open new candle bar
      const newBar: CandleData = {
        time: currentMinute,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
        volume: 50,
      };
      lastBarRef.current = newBar;
      candleSeriesRef.current.update({
        time: newBar.time,
        open: newBar.open,
        high: newBar.high,
        low: newBar.low,
        close: newBar.close,
      });
      volumeSeriesRef.current.update({
        time: newBar.time,
        value: newBar.volume,
        color: "rgba(16, 185, 129, 0.4)",
      });
    }
  }, [marketDepth]);

  const handleFitContent = () => {
    chartRef.current?.timeScale().fitContent();
  };

  return (
    <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
      <CardHeader className="py-2.5 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm font-semibold tracking-tight text-slate-800">
              TradingView Chart ({selectedSymbol})
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-[11px] font-medium text-slate-600">
            {["1m", "5m", "15m"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  timeframe === tf
                    ? "bg-white text-slate-900 font-bold shadow-xs"
                    : "hover:text-slate-900"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wsConnected ? (
            <Badge
              variant="outline"
              className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 border-emerald-200 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE TICK SYNC
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] font-mono font-medium text-amber-700 bg-amber-50 border-amber-200"
            >
              DISCONNECTED
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={loadCandleHistory}
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
            title="Reload Chart History"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitContent}
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative bg-white">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Loading chart history...
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-[380px]" />
      </CardContent>
    </Card>
  );
}
