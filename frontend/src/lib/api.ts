import {
  Order,
  Trade,
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
  TAccountsOverview,
  ContractNoteSummary,
  CustomerCashEntry,
  LedgerSummary,
  AgentChatResponse,
  ExecuteProposedResult,
  WhatIfSimulationRequest,
  WhatIfSimulationResult,
  Side,
  OrderType,
  ProductType,
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

  modifyOrder: (
    orderId: string,
    payload: { new_quantity?: number; new_price?: number },
    accountId: string = "DEFAULT"
  ) =>
    fetchJson<Order>(`/api/v1/orders/${orderId}?account_id=${accountId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  cancelOrder: (orderId: string, accountId: string = "DEFAULT") =>
    fetchJson<Order>(`/api/v1/orders/${orderId}?account_id=${accountId}`, {
      method: "DELETE",
    }),

  getTrades: (accountId: string = "DEFAULT", symbol?: string) =>
    fetchJson<Trade[]>(
      `/api/v1/orders/trades/history?account_id=${accountId}${
        symbol ? `&symbol=${symbol}` : ""
      }`
    ),

  // Portfolio & Positions
  getPositions: (accountId: string = "DEFAULT") =>
    fetchJson<Position[]>(`/api/v1/positions?account_id=${accountId}`),

  getHoldings: (accountId: string = "DEFAULT") =>
    fetchJson<Holding[]>(`/api/v1/holdings?account_id=${accountId}`),

  squareOffPosition: (symbol: string, accountId: string = "DEFAULT") =>
    fetchJson<{
      status: string;
      symbol: string;
      side: string;
      closed_quantity: number;
      exit_price: number;
      order_id: string;
      order_status: string;
      realized_pnl: number;
    }>(`/api/v1/portfolio/squareoff/${symbol}?account_id=${accountId}`, {
      method: "POST",
    }),

  triggerMISSquareOff: (accountId?: string) =>
    fetchJson<Array<{
      account_id: string;
      symbol: string;
      closed_quantity: number;
      side: string;
      exit_price: number;
      order_id: string;
      status: string;
      realized_pnl?: number;
    }>>(
      `/api/v1/settlement/mis-squareoff${
        accountId ? `?account_id=${accountId}` : ""
      }`,
      {
        method: "POST",
      }
    ),

  // Ledger & Accounting
  getLedgerSummary: (accountId: string = "DEFAULT") =>
    fetchJson<{
      account_id: string;
      running_balance: number;
      entries_count: number;
      entries: Array<{
        entry_id: string;
        account_id: string;
        category: string;
        debit: number;
        credit: number;
        running_balance: number;
        reference_id: string;
        description: string;
        timestamp: string;
      }>;
    }>(`/api/v1/ledger?account_id=${accountId}`),

  getTAccountsOverview: (accountId: string = "DEFAULT") =>
    fetchJson<{
      total_debits: number;
      total_credits: number;
      discrepancy: number;
      is_balanced: boolean;
      accounts: Array<{
        category: string;
        total_debits: number;
        total_credits: number;
        net_balance: number;
      }>;
      timestamp: string;
    }>(`/api/v1/ledger/t-accounts?account_id=${accountId}`),

  getTAccounts: (accountId: string = "DEFAULT") =>
    fetchJson<DoubleEntryReport>(`/api/v1/ledger/t-accounts?account_id=${accountId}`),

  getContractNotesSummary: (accountId: string = "DEFAULT") =>
    fetchJson<{
      account_id: string;
      total_brokerage: number;
      total_stt: number;
      total_exchange_turnover: number;
      total_sebi_fees: number;
      total_stamp_duty: number;
      total_gst: number;
      total_charges: number;
      trades_count: number;
    }>(`/api/v1/ledger/contract-notes?account_id=${accountId}`),


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

  seedDemoBook: (symbol: string = "RELIANCE") =>
    fetchJson<{
      status: string;
      symbol: string;
      total_shares_seeded: number;
      message: string;
    }>("/api/v1/system/seed-demo-book", {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),

  // Margin Pre-Check
  previewMarginAndCharges: (payload: MarginCheckRequest) =>
    fetchJson<MarginCheckResponse>("/api/v1/margin/check", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Copilot Chat
  copilotChat: (prompt: string, accountId: string = "DEFAULT") =>
    fetchJson<AgentChatResponse>("/api/v1/agent/chat", {
      method: "POST",
      body: JSON.stringify({ prompt, query: prompt, account_id: accountId }),
    }),

  executeProposedOrder: (payload: {
    symbol: string;
    side: Side;
    quantity: number;
    price?: number;
    order_type?: OrderType;
    product_type?: ProductType;
    account_id?: string;
  }) =>
    fetchJson<ExecuteProposedResult>("/api/v1/agent/execute-proposed", {
      method: "POST",
      body: JSON.stringify({
        account_id: payload.account_id || "DEFAULT",
        symbol: payload.symbol,
        side: payload.side,
        quantity: payload.quantity,
        price: payload.price,
        order_type: payload.order_type || "LIMIT",
        product_type: payload.product_type || "CNC",
      }),
    }),

  // What-If Simulation
  simulateScenario: (payload: WhatIfSimulationRequest) =>
    fetchJson<WhatIfSimulationResult>("/api/v1/agent/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
