"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTradingStore } from "@/store/useTradingStore";
import { AgentAlert, MarketDepth, Order } from "@/lib/types";

export function useWebSocketStream() {
  const accountId = useTradingStore((s) => s.accountId);
  const setWsConnected = useTradingStore((s) => s.setWsConnected);
  const updateMarketDepth = useTradingStore((s) => s.updateMarketDepth);
  const addOrUpdateOrder = useTradingStore((s) => s.addOrUpdateOrder);
  const addAlert = useTradingStore((s) => s.addAlert);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    // Avoid double connect
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Determine WS URL
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const wsUrl = `ws://${host}:8000/ws/${accountId}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Subscribe to initial market symbols
        ws.send(
          JSON.stringify({
            action: "subscribe_market",
            symbols: ["RELIANCE", "TCS", "INFY"],
          })
        );

        // Start heartbeat ping
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "ping" }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const type = msg.type;
          const data = msg.data || msg;

          if (type === "TICK_RECEIVED" || msg.event_type === "TICK_RECEIVED") {
            const rawDepth = data.market_depth || data;
            if (rawDepth && rawDepth.symbol) {
              const depth: MarketDepth = {
                symbol: rawDepth.symbol,
                bids: rawDepth.bids || [],
                asks: rawDepth.asks || [],
                ltp: Number(rawDepth.ltp || data.ltp || 0),
                timestamp: rawDepth.timestamp || new Date().toISOString(),
                high: rawDepth.high ? Number(rawDepth.high) : undefined,
                low: rawDepth.low ? Number(rawDepth.low) : undefined,
                open: rawDepth.open ? Number(rawDepth.open) : undefined,
                close: rawDepth.close ? Number(rawDepth.close) : undefined,
                volume: rawDepth.volume ? Number(rawDepth.volume) : undefined,
              };
              updateMarketDepth(depth);
            }
          } else if (
            type === "ORDER_CREATED" ||
            type === "ORDER_FILLED" ||
            type === "ORDER_CANCELLED"
          ) {
            if (data.order_id) {
              addOrUpdateOrder(data as Order);
            }
          } else if (type === "AGENT_ALERT" || msg.event_type === "AGENT_ALERT") {
            const alert: AgentAlert = {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              symbol: data.symbol || "MARKET",
              condition: data.condition || "Market Risk Event",
              severity: data.severity || "HIGH",
              brief: data.brief || data.message || "Proactive risk anomaly detected.",
              timestamp: msg.timestamp || new Date().toISOString(),
            };
            addAlert(alert);
          }
        } catch {
          // Ignore JSON parse errors on malformed frames
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setWsConnected(false);
    }
  }, [accountId, setWsConnected, updateMarketDepth, addOrUpdateOrder, addAlert]);

  useEffect(() => {
    connect();

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((message: object) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { send };
}
