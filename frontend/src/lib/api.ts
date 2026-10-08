import {
  Order,
  Position,
  Holding,
  MarketDepth,
  DoubleEntryReport,
  FeedStatus,
  CreateOrderPayload,
  ChargesBreakdown,
  CandleHistoryResponse,
  MarginCheckRequest,
  MarginCheckResponse,
  OrderPlacementResponse,
} from "./types";

// Base API route proxied by Next.js rewrites to http://localhost:8000
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorDetail = errorText;
    try {
      const errJson = JSON.parse(errorText);
      errorDetail = errJson.detail || errJson.message || errorText;
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail || `API request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Orders
  getOrders: (accountId: string = "DEFAULT") =>
    fetchJson<Order[]>(`/api/v1/orders?account_id=${accountId}`),

  createOrder: (payload: CreateOrderPayload) =>
    fetchJson<OrderPlacementResponse>("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  cancelOrder: (orderId: string) =>
    fetchJson<{ message: string }>(`/api/v1/orders/${orderId}`, {
      method: "DELETE",
    }),

  // Portfolio & Positions
  getPositions: (accountId: string = "DEFAULT") =>
    fetchJson<Position[]>(`/api/v1/portfolio/${accountId}/positions`),

  getHoldings: (accountId: string = "DEFAULT") =>
    fetchJson<Holding[]>(`/api/v1/portfolio/${accountId}/holdings`),

  // Ledger & Accounting
  getLedgerSummary: (accountId: string = "DEFAULT") =>
    fetchJson<{
      account_id: string;
      cash_balance: number;
      available_cash: number;
      blocked_margin: number;
      realized_pnl: number;
      unrealized_pnl: number;
    }>(`/api/v1/ledger/${accountId}/summary`),

  getTAccounts: (accountId: string = "DEFAULT") =>
    fetchJson<DoubleEntryReport>(`/api/v1/ledger/${accountId}/t-accounts`),

  // Market Data
  getMarketDepth: (symbol: string) =>
    fetchJson<MarketDepth>(`/api/v1/market/depth/${symbol}`),

  getCandles: (symbol: string, timeframe: string = "1m", limit: number = 60) =>
    fetchJson<CandleHistoryResponse>(
      `/api/v1/market/candles/${symbol}?timeframe=${timeframe}&limit=${limit}`
    ),

  getMarketStatus: () =>
    fetchJson<FeedStatus>("/api/v1/market/status"),

  setFeedMode: (mode: "LIVE" | "REPLAY") =>
    fetchJson<FeedStatus>("/api/v1/market/feed-mode", {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),

  // System Resilience & Audit
  reconcileAudit: () =>
    fetchJson<DoubleEntryReport>("/api/v1/system/reconcile"),

  crashReplay: () =>
    fetchJson<{
      status: string;
      events_replayed: number;
      reconciliation: DoubleEntryReport;
    }>("/api/v1/system/crash-replay", {
      method: "POST",
    }),

  simulateDrop: (symbol: string, percentage: number = 5.0) =>
    fetchJson<{ status: string; message: string }>("/api/v1/system/simulate-drop", {
      method: "POST",
      body: JSON.stringify({ symbol, drop_pct: percentage }),
    }),

  // Margin Pre-Check
  previewMarginAndCharges: (payload: MarginCheckRequest) =>
    fetchJson<MarginCheckResponse>("/api/v1/margin/check", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Copilot Chat
  copilotChat: (prompt: string, accountId: string = "DEFAULT") =>
    fetchJson<{
      response: string;
      agent_routed: string;
      proposed_order?: CreateOrderPayload;
      citations?: Array<{ title: string; source: string; url?: string }>;
    }>("/api/v1/agent/chat", {
      method: "POST",
      body: JSON.stringify({ prompt, account_id: accountId }),
    }),

  executeProposedOrder: (orderPayload: CreateOrderPayload) =>
    fetchJson<Order>("/api/v1/agent/execute-proposed", {
      method: "POST",
      body: JSON.stringify(orderPayload),
    }),
};
