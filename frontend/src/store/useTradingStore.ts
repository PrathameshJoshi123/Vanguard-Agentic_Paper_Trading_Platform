import { create } from "zustand";
import {
  Order,
  Position,
  Holding,
  MarketDepth,
  DoubleEntryReport,
  FeedStatus,
  AgentAlert,
} from "@/lib/types";

interface CashSummary {
  cash_balance: number;
  available_cash: number;
  blocked_margin: number;
  realized_pnl: number;
  unrealized_pnl: number;
}

interface TradingState {
  accountId: string;
  selectedSymbol: string;
  wsConnected: boolean;
  marketDepth: Record<string, MarketDepth>;
  orders: Order[];
  positions: Position[];
  holdings: Holding[];
  cashSummary: CashSummary;
  auditReport: DoubleEntryReport | null;
  feedStatus: FeedStatus | null;
  alerts: AgentAlert[];

  // Actions
  setAccountId: (id: string) => void;
  setSelectedSymbol: (symbol: string) => void;
  setWsConnected: (connected: boolean) => void;
  updateMarketDepth: (depth: MarketDepth) => void;
  setOrders: (orders: Order[]) => void;
  addOrUpdateOrder: (order: Order) => void;
  setPositions: (positions: Position[]) => void;
  setHoldings: (holdings: Holding[]) => void;
  setCashSummary: (summary: CashSummary) => void;
  setAuditReport: (report: DoubleEntryReport | null) => void;
  setFeedStatus: (status: FeedStatus | null) => void;
  addAlert: (alert: AgentAlert) => void;
  dismissAlert: (id: string) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  accountId: "DEFAULT",
  selectedSymbol: "RELIANCE",
  wsConnected: false,
  marketDepth: {},
  orders: [],
  positions: [],
  holdings: [],
  cashSummary: {
    cash_balance: 50000,
    available_cash: 50000,
    blocked_margin: 0,
    realized_pnl: 0,
    unrealized_pnl: 0,
  },
  auditReport: {
    is_balanced: true,
    discrepancy: 0,
    total_debits: 50000,
    total_credits: 50000,
    timestamp: new Date().toISOString(),
  },
  feedStatus: {
    mode: "LIVE",
    is_live: true,
    active_symbol: "RELIANCE",
    tick_rate: 1.0,
    sequence_gap_count: 0,
    duplicate_count: 0,
  },
  alerts: [],

  setAccountId: (accountId) => set({ accountId }),
  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
  setWsConnected: (wsConnected) => set({ wsConnected }),

  updateMarketDepth: (depth) =>
    set((state) => ({
      marketDepth: {
        ...state.marketDepth,
        [depth.symbol]: depth,
      },
    })),

  setOrders: (orders) => set({ orders }),

  addOrUpdateOrder: (order) =>
    set((state) => {
      const idx = state.orders.findIndex((o) => o.order_id === order.order_id);
      if (idx >= 0) {
        const next = [...state.orders];
        next[idx] = order;
        return { orders: next };
      }
      return { orders: [order, ...state.orders] };
    }),

  setPositions: (positions) => set({ positions }),
  setHoldings: (holdings) => set({ holdings }),
  setCashSummary: (cashSummary) => set({ cashSummary }),
  setAuditReport: (auditReport) => set({ auditReport }),
  setFeedStatus: (feedStatus) => set({ feedStatus }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts.slice(0, 49)], // Keep latest 50
    })),

  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),
}));
