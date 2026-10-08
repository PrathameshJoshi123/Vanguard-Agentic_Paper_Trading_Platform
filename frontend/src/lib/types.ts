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
  average_price: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_charges?: number;
  net_pnl?: number;
  is_open?: boolean;
  is_long?: boolean;
  buy_quantity?: number;
  sell_quantity?: number;
  buy_value?: number;
  sell_value?: number;
  vwap_buy_price?: number;
  last_price?: number;
}

export interface Holding {
  account_id: string;
  symbol: string;
  quantity: number;
  average_buy_price?: number;
  average_price?: number;
  current_value?: number;
  total_pnl?: number;
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
  turnover?: number;
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

export interface CandleBar {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleHistoryResponse {
  symbol: string;
  timeframe: string;
  candles: CandleBar[];
}

export interface MarginCheckRequest {
  account_id: string;
  symbol: string;
  side: Side;
  order_type: OrderType;
  product_type: ProductType;
  quantity: number;
  price?: number;
  trigger_price?: number;
}

export interface MarginCheckResponse {
  sufficient: boolean;
  required_margin: number;
  available_margin: number;
  shortfall: number;
  charges: ChargesBreakdown;
}

export interface OrderPlacementResponse {
  order: Order;
  trades: Trade[];
  total_charges: number;
  account_balance: number;
}

export interface TAccountItem {
  category: string;
  total_debits: number;
  total_credits: number;
  net_balance: number;
}

export interface TAccountsOverview {
  total_debits: number;
  total_credits: number;
  discrepancy: number;
  is_balanced: boolean;
  accounts: TAccountItem[];
  timestamp: string;
}

export interface ContractNoteSummary {
  account_id: string;
  total_brokerage: number;
  total_stt: number;
  total_exchange_turnover: number;
  total_sebi_fees: number;
  total_stamp_duty: number;
  total_gst: number;
  total_charges: number;
  trades_count: number;
}

export interface CustomerCashEntry {
  entry_id: string;
  account_id: string;
  category: string;
  debit: number;
  credit: number;
  running_balance: number;
  reference_id: string;
  description: string;
  timestamp: string;
}

export interface LedgerSummary {
  account_id: string;
  running_balance: number;
  entries_count: number;
  entries: CustomerCashEntry[];
}

export interface OrderModifyPayload {
  new_quantity?: number;
  new_price?: number;
}

export interface SquareOffResponse {
  status: string;
  symbol: string;
  side: string;
  closed_quantity: number;
  exit_price: number;
  order_id: string;
  order_status: string;
  realized_pnl: number;
}

export interface MISSquareOffResult {
  account_id: string;
  symbol: string;
  closed_quantity: number;
  side: string;
  exit_price: number;
  order_id: string;
  status: string;
  realized_pnl?: number;
}

// Phase 7E: AI Copilot, Policy Gate & Simulation Types
export interface WebCitation {
  title: string;
  link: string;
  source: string;
  summary: string;
  published: string;
}

export interface OrderProposalPayload {
  proposal_id?: string;
  account_id: string;
  symbol: string;
  side: Side;
  order_type: OrderType;
  product_type: ProductType;
  quantity: number;
  price: number;
  estimated_order_value: number;
  status?: string;
}

export interface PolicyCheckResult {
  status: "NEEDS_APPROVAL" | "REJECTED" | string;
  reason?: string;
  order_payload?: OrderProposalPayload;
}

export interface ExecuteProposedResult {
  status: string;
  order_id: string;
  symbol: string;
  side: string;
  filled_qty: number;
  remaining_qty: number;
  average_fill_price?: string | null;
  trades_count: number;
}

export interface AgentChatResponse {
  response: string;
  agent_routed: string;
  citations: WebCitation[];
  policy_result?: PolicyCheckResult | null;
  proposed_order?: OrderProposalPayload | null;
  specialist_data?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  agent_routed?: string;
  citations?: WebCitation[];
  policy_result?: PolicyCheckResult | null;
  proposed_order?: OrderProposalPayload | null;
  execution_result?: ExecuteProposedResult | null;
}

export interface WhatIfSimulatedPosition {
  symbol: string;
  product_type: ProductType;
  quantity: number;
  average_price: number;
  current_price: number;
  simulated_price: number;
  price_change_pct: number;
  current_unrealized_pnl: number;
  projected_unrealized_pnl: number;
  pnl_delta: number;
}

export interface WhatIfPriceScenario {
  symbol: string;
  price_change_pct?: number;
  target_price?: number;
}

export interface WhatIfHypotheticalOrder {
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
  product_type?: ProductType;
}

export interface WhatIfSimulationRequest {
  account_id: string;
  scenarios?: WhatIfPriceScenario[];
  hypothetical_orders?: WhatIfHypotheticalOrder[];
  natural_language_prompt?: string;
}

export interface WhatIfSimulationResult {
  account_id: string;
  current_total_unrealized_pnl: number;
  projected_total_unrealized_pnl: number;
  projected_pnl_delta: number;
  current_margin_utilized: number;
  projected_margin_utilized: number;
  available_cash: number;
  positions: WhatIfSimulatedPosition[];
  projected_charges: number;
  risk_assessment: string;
  narrative_summary: string;
}


