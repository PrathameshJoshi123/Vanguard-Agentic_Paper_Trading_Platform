export type Side = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET" | "SL" | "SL_M";
export type OrderStatus =
  | "PENDING"
  | "OPEN"
  | "TRIGGER_PENDING"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELLED"
  | "REJECTED";
export type ProductType = "CNC" | "MIS";

export interface Order {
  order_id: string;
  account_id: string;
  symbol: string;
  side: Side;
  order_type: OrderType;
  product_type: ProductType;
  price?: number | null;
  trigger_price?: number | null;
  quantity: number;
  filled_qty: number;
  remaining_qty: number;
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
  average_fill_price?: number;
}

export interface Trade {
  trade_id: string;
  order_id: string;
  symbol: string;
  side: Side;
  price: number;
  quantity: number;
  counterparty_order_id?: string;
  is_maker: boolean;
  timestamp: string;
}

export interface Position {
  account_id: string;
  symbol: string;
  product_type: ProductType;
  quantity: number;
  buy_quantity: number;
  sell_quantity: number;
  buy_value: number;
  sell_value: number;
  vwap_buy_price: number;
  realized_pnl: number;
  unrealized_pnl: number;
  last_price: number;
}

export interface Holding {
  account_id: string;
  symbol: string;
  quantity: number;
  average_price: number;
  current_value: number;
  total_pnl: number;
}

export interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface MarketDepth {
  symbol: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  ltp: number;
  timestamp: string;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
  volume?: number;
}

export interface ChargesBreakdown {
  brokerage: number;
  stt: number;
  exchange_turnover: number;
  sebi_fees: number;
  stamp_duty: number;
  gst: number;
  total_charges: number;
}

export interface AccountRiskState {
  account_id: string;
  cash_balance: number;
  available_cash: number;
  blocked_margin: number;
  realized_pnl: number;
  unrealized_pnl: number;
}

export interface DoubleEntryReport {
  is_balanced: boolean;
  discrepancy: number;
  total_debits: number;
  total_credits: number;
  timestamp: string;
  account_balances?: Record<string, number>;
}

export interface AgentAlert {
  id: string;
  symbol: string;
  condition: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  brief: string;
  timestamp: string;
}

export interface FeedStatus {
  mode: "LIVE" | "REPLAY";
  is_live: boolean;
  active_symbol: string;
  tick_rate: number;
  sequence_gap_count: number;
  duplicate_count: number;
}

export interface CreateOrderPayload {
  account_id: string;
  symbol: string;
  side: Side;
  order_type: OrderType;
  product_type: ProductType;
  quantity: number;
  price?: number;
  trigger_price?: number;
}
