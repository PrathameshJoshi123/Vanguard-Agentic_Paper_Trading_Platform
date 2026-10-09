# SYRUS_7 — Project Progress Tracker

This document tracks the end-to-end implementation progress of the **PS-05 Paper Trading Platform**, maintaining an exhaustive, minute-level record of all architectural decisions, setup steps, domain modules, and verification tests. Any AI agent or developer reading this document will immediately understand the current state and what to build next.

---

## 1. Environment & Tech Stack Specifications

- **OS**: Windows (PowerShell)
- **Python**: 3.13.0
- **Virtual Environment**: `.venv` located at the project root (`D:\My_Space\SYRUS_7\.venv`)
  - Activation: `.\.venv\Scripts\Activate.ps1`
  - Python binary: `.\.venv\Scripts\python.exe`
- **Core Libraries**:
  - `fastapi` (v0.142.4)
  - `uvicorn` (v0.54.0)
  - `pydantic` (v2.13.5)
  - `pydantic-settings` (v2.15.0)
  - `sqlalchemy` (v2.1.4)
  - `asyncpg` (v0.32.0)
  - `pytest` (v9.1.1)
  - `pytest-asyncio` (v1.4.0)
- **Monolith Architecture**:
  - Unified repository (`src/`), strictly avoiding distributed microservices while retaining domain segregation.
  - In-memory order book designed to directly ingest future L2 live market depth & ticks.
  - Agentic Intelligence plane is isolated from the deterministic low-latency trading path.

---

## 2. Key Architectural Decisions (Confirmed by User)

1. **Price Precision**: Strict Python `Decimal` (avoiding floating point inaccuracies, formatted to standard paisa precision `0.01`).
2. **Trade Events & Fills (Option B)**:
   - Each executed match produces individual order-level trade events (`TradeEvent` per order leg) capturing `trade_id`, `order_id`, `symbol`, `side`, `price`, `quantity`, `counterparty_order_id`, `is_maker`, and `timestamp`.
   - The matching engine output also records the atomic match execution (`MatchRecord`) linking maker and taker for exchange-level audit.
3. **Market Order Depth Policy (Option A - IOC Style)**:
   - If a `MARKET` order arrives and opposite book depth is insufficient to satisfy the full quantity, it fills all available resting depth at the top of the book and cancels the unfilled remainder.
4. **Deterministic Core Separation**:
   - Pure domain matching engine and state machine in `src/core/` are decoupled from I/O and databases for ultra-fast, deterministic unit testing and replayability.

---

## 3. Phase-by-Phase Roadmap

- [x] **Phase 1: Core In-Memory Matching & Order State Machine** *(COMPLETED)*
- [x] **Phase 2: Financial Engine & Indian Regulatory Accounting** *(COMPLETED)*
  - [x] Pure deterministic Indian Regulatory Charges Calculator (`src/ledger/charges.py`): Brokerage, STT, Exchange turnover, SEBI fees, Stamp duty, GST
  - [x] Margin & Risk Engine (`src/risk/margin.py`, `src/risk/engine.py`): CNC 100%, MIS 20% leverage (5x), pre-trade checks, margin blocking on limit orders, margin release on cancel
  - [x] Position & Portfolio Engine (`src/portfolio/models.py`, `src/portfolio/position_manager.py`): Real-time VWAP, Realized P&L, MTM Unrealized P&L, Long/Short/Reversal
  - [x] Immutable Double-Entry Ledger (`src/ledger/models.py`, `src/ledger/journal.py`): Dual-layer customer cash journal with running balance and strict balanced T-accounts
  - [x] Storage Integration (`src/storage/database.py`, `src/storage/models/`): SQLAlchemy 2.0 Async PostgreSQL/Supabase models & async engine
  - [x] End-to-End Orchestrator (`src/core/trade_service.py`): Deterministic order-to-ledger execution pipeline
  - [x] Verification Suite: 31 tests all passing, including the Phase 2 round-trip trade exit criteria (Buy 100 @ 100, Sell 100 @ 110 MIS -> Gross ₹1,000, Charges ₹11.26, Running Balance ₹50,988.74)
- [x] **Phase 3: Market Data Engine & L2 Live Ticks Ingestion** *(COMPLETED)*
  - [x] MarketDepth DTO & L2 Normalizer (`src/market_data/models.py`, `src/market_data/normalizer.py`): Ingests top 5 bid/ask structures, LTP, volume, OHLC with Decimal precision.
  - [x] Sequence & Feed Resilience Manager (`src/market_data/sequence_manager.py`): Drops duplicates, filters out-of-order ticks, tracks sequence gaps, and monitors feed health.
  - [x] Dual-Mode Feed Handler (`src/market_data/live_feed.py`, `src/market_data/replay_engine.py`): Resilient live NSE India quote fetching and async `.jsonl` historical tick replayer with configurable speed pacing.
  - [x] Unified Gateway (`src/market_data/gateway.py`): Seamless switching between Live and Replay modes with subscriber dispatch.
  - [x] Market Depth Matcher & SL/SL-M Engine (`src/market_data/depth_matcher.py`): Bridges market depth updates into the engine, evaluates Stop-Loss triggers, and fills resting limit orders.
  - [x] Verification Suite: 39 tests all passing, including the Phase 3 Exit Criteria (50 historical RELIANCE ticks replay fills resting limit orders).
- [x] **Phase 4 & 6: Proactive Features, Simulation & MIS Square-off** *(COMPLETED)*
  - [x] **Autonomous Event-Driven Monitor** (`src/agentic/monitor/`): Background worker subscribed to in-memory Event Bus. Listens for `UNREALIZED_LOSS > 5%` or `TICK_PRICE_DROP > 3%`, throttled by a 60-second cooldown and 2% incremental re-trigger rule. Synthesizes an async LLM risk brief via Mistral AI and publishes `AGENT_ALERT` to the event bus / WebSocket stream.
  - [x] **What-If Simulation Engine** (`src/simulation/`): Endpoints `POST /api/v1/agent/simulate` and `/agent/simulate`. In-memory snapshot cloning of active positions and account state, runs real MTM math, regulatory charges, and margin rules without mutating live trading state. Supports structured percentage shifts, target prices, hypothetical new trades, and natural-language queries (e.g., "What if TCS falls 6%?").
  - [x] **Deterministic MIS Auto Square-off & Scheduler** (`src/settlement/mis_squareoff.py`, `src/scheduler/service.py`): Pure deterministic execution scanning open MIS positions and injecting closing market orders into the engine. Governed by APScheduler (`TradingSchedulerService`) configured for 15:20:00 IST with manual/simulation trigger capability.
  - [x] **Exit Criteria Verified**: Fired simulated tick showing a 6% drop in a held stock; observed unprompted, structured `AGENT_ALERT` on WebSocket stream in < 2 seconds (`test_phase6_proactive_alert.py`).
  - [x] **Verification Suite**: 68 tests passing across unit and integration suites (100% test pass rate).
- [x] **Phase 5: Agentic Intelligence Plane & Tool Policy Gateway** *(COMPLETED)*
  - [x] Multi-Agent LangGraph Supervisor Network (`src/agentic/graph.py`, `src/agentic/supervisor.py`, `src/agentic/synthesizer.py`): Supervisor orchestrates intent routing to Research, Portfolio, and Trade Proposer specialist agents.
  - [x] Mistral LLM Integration & Mock Fallback (`src/agentic/llm.py`, `src/agentic/config.py`): Pluggable Mistral client (`langchain-mistralai`) with deterministic fallback for offline testing.
  - [x] Tool Policy Gateway / Firewall (`src/agentic/policy/engine.py`, `src/agentic/policy/models.py`, `src/agentic/tools/write_tools.py`): Enforces hard safety limits (Max position size ₹50,000, Max single loss ₹2,000, Account Margin Check). Returns structured `{status: "NEEDS_APPROVAL", order_payload: {...}}` or rejection.
  - [x] Read-Only Tool Gateway (`src/agentic/tools/read_tools.py`): `get_current_price`, `get_portfolio_positions`, `get_ledger_summary`, `get_news_by_symbol` directly inspect trading plane without side effects.
  - [x] Multi-Source Research & Web Intelligence (`src/agentic/tools/scraper.py`): Multi-source engine combining DuckDuckGo search (`ddgs` library) for live web news & broker research with Google News RSS and Moneycontrol RSS feeds.
  - [x] Live Mistral LLM Integration (`src/agentic/llm.py`, `src/agentic/synthesizer.py`): Full integration with Mistral AI via `langchain-mistralai` (`ChatMistralAI`), verified live with active API credentials and comprehensive test coverage.
- [x] **Phase 7A: Backend API Support & Crash Recovery** *(COMPLETED)*
  - [x] **Event Store Persistence** (`src/storage/models/event_log.py`, `src/events/consumers/persistence.py`): Immutable `EventLogModel` table appending all domain events in chronological order, with full JSON payloads and sequence numbers. Materialized database persistence for orders, trades, cash journal, and positions.
  - [x] **Continuous Audit Reconciliation Engine** (`src/core/reconciliation.py`): Multi-dimensional integrity auditor verifying Double-Entry T-Accounts equilibrium (`Total Debits == Total Credits`), Customer Cash Running Balance against Account Risk State, Trade-to-Order fills, and Net Position quantities matching executed trades. Guarantees ₹0.00 discrepancy.
  - [x] **Crash Recovery Service** (`src/core/recovery.py`): Cold restart reconstructor that wipes in-memory execution structures, reads durable database records / event store, restores active accounts, re-populates resting orders into matching engine books, re-establishes position quantities and double-entry journals, and runs reconciliation verification.
  - [x] **Market Feed & Resilience Router** (`src/api/routers/market.py`): Endpoints `GET /market/depth/{symbol}`, `GET /market/status`, and `POST /market/feed-mode` (the "Demo Toggle Switch") allowing instant dynamic switching between Live NSE feed and Offline Replay.
  - [x] **System Resilience & Demo Router** (`src/api/routers/system.py`): Endpoints `POST /system/crash-replay` (Step 2 Demo: cold restart from event log), `GET /system/reconcile` (real-time audit report), and `POST /system/simulate-drop` (Step 4 Demo: instant drop injection triggering autonomous alert feed).
  - [x] **Agent Proposed Order Execution** (`src/api/routers/agent.py`): Endpoint `POST /agent/execute-proposed` executing user-approved trade proposals directly into the deterministic matching engine.
  - [x] **Verification Suite**: 72 tests passing across unit and integration suites (100% test pass rate).
- [x] **Phase 7B: Next.js 15 Monolith Scaffold & Theme Setup** *(COMPLETED)*
  - [x] **Monolith Scaffold**: Initialized Next.js 15 (App Router, React 19, TypeScript, Tailwind CSS v4) inside `frontend/` collocated within the repository.
  - [x] **shadcn/ui Suite**: Initialized with base-nova preset and added core components (`card`, `badge`, `tabs`, `table`, `input`, `label`, `switch`, `dialog`, `select`, `separator`, `tooltip`, `alert`).
  - [x] **Zustand State Architecture** (`frontend/src/store/useTradingStore.ts`): High-framerate store holding market depths, order books, positions, holdings, cash journals, audit reports, and alerts.
  - [x] **Streaming WebSocket Hook** (`frontend/src/hooks/useWebSocketStream.ts`): Persistent connection to `ws://localhost:8000/ws/{account_id}` with exponential backoff reconnect, 20s ping heartbeats, symbol depth subscriptions, and typed event demultiplexing.
  - [x] **Institutional Pure White Theme & Layout**:
    - `Sidebar.tsx`: Fixed navigation linking Trading Terminal (`/`), Portfolio (`/portfolio`), Orders (`/orders`), Ledger (`/ledger`), and Copilot (`/copilot`).
    - `TopHeader.tsx`: Global status bar with Demo Toggle Switch (`LIVE NSE` vs `OFFLINE REPLAY`), Available Cash, Realized P&L, Zero-Discrepancy audit badge (`₹0.00 Discrepancy`), Crash Replay button, and WebSocket connection indicator.
  - [x] **API Client & Proxies**: Configured `frontend/next.config.ts` with API rewrites (`/api/*` -> `http://localhost:8000/*`) and typed REST client in `frontend/src/lib/api.ts`.
  - [x] **Verification**: Production build (`npm run build`) succeeded with 0 errors across all 6 static/dynamic routes.
- [x] **Phase 7C: Trading Terminal & Charts** *(COMPLETED)*
  - [x] **TradingView Lightweight Charts** (`frontend/src/components/terminal/TradingViewChart.tsx`): High-performance canvas chart rendering Candlestick and Volume histogram series, dynamic resize observer, historical OHLCV loading, and live tick synthesis via WebSocket stream.
  - [x] **5-Depth Level 2 Order Book** (`frontend/src/components/terminal/OrderBookL2.tsx`): Top 5 Bids (emerald) and Top 5 Asks (rose) with volume depth bars proportional to level quantity, live spread calculation, buyer/seller volume ratio, and click-to-trade prefill callback.
  - [x] **Order Execution Ticket** (`frontend/src/components/terminal/OrderTicket.tsx`): Institutional order entry supporting `BUY`/`SELL`, `CNC`/`MIS`, `MARKET`/`LIMIT`/`SL`/`SL_M`, quick lot buttons (+25, +50, +100), click-to-trade price sync, and instant execution feedback.
  - [x] **Live Indian Regulatory Charges & Margin Preview** (`frontend/src/components/terminal/ChargesPreview.tsx`, `frontend/src/lib/charges.ts`): Client-side 60fps deterministic calculator mirrored to paise precision, plus 250ms debounced server verification via `POST /api/v1/margin/check`. Itemizes Brokerage, STT, Exchange fees, SEBI charges, Stamp duty, and GST, alongside required margin and cash buffer.
  - [x] **Backend Support Endpoints**:
    - `POST /api/v1/margin/check` (`src/api/routers/margin.py`): Validates pre-trade margin sufficiency and returns statutory tax breakdown.
    - `GET /api/v1/market/candles/{symbol}` (`src/api/routers/market.py`): Delivers chronologically ordered 1-minute OHLCV bars for TradingView charts.
  - [x] **Verification Suite**: 76 pytest tests passing (100% test pass rate), Next.js production build (`npm run build`) succeeded with 0 errors across all routes.
- [x] **Phase 7D: Portfolio, Orders & Double-Entry Ledger Views** *(COMPLETED)*
  - [x] **Portfolio & Positions Workspace** (`frontend/src/app/portfolio/page.tsx`):
    - `PositionsTable.tsx`: Live open positions table with real-time VWAP, Mark-to-Market (MTM) P&L updates from tick feed, realized P&L, incurred charges, and single-click individual position square-off.
    - `HoldingsTable.tsx`: Delivery inventory table (CNC) displaying symbol, holding quantity, average buy price, current LTP, invested capital, current market value, and total return (₹ and %).
    - `MISSquareOffBanner.tsx`: Prominent 15:20:00 IST auto square-off banner with live countdown timer and judge-accessible "Force Square-Off" modal simulation trigger.
    - KPI Cards: Invested Capital, Holdings Market Value, Live Unrealized MTM, and Realized P&L settled into cash ledger.
  - [x] **Orders & Executions Workspace** (`frontend/src/app/orders/page.tsx`):
    - `OpenOrdersTable.tsx`: Resting order book inspection (`OPEN`, `PENDING`, `TRIGGER_PENDING`, `PARTIALLY_FILLED`) with in-line order cancellation (instant margin release) and modification modal triggers.
    - `OrderModifyModal.tsx`: User-approved Modal Dialog showing original vs new quantity and limit price with live margin delta impact calculation.
    - `TradeHistoryTable.tsx`: Complete trade execution history with expandable multi-level book-walk inspection tracing parent orders to atomic match legs with maker/taker flags.
  - [x] **Regulatory Accounting & Ledger Audit Workspace** (`frontend/src/app/ledger/page.tsx`):
    - `TAccountsCard.tsx`: User-approved Option B Modern Financial Ledger Card Grid rendering separate Debit/Credit bars, net liability/asset status, and top equilibrium validator badge (`₹0.00 Discrepancy Verified`).
    - `ContractNoteCard.tsx`: Itemized breakdown of statutory levies (Brokerage, STT, Exchange turnover fees, SEBI charges, Stamp duty, 18% GST) per settlement.
    - `CashJournalTable.tsx`: Chronological append-only customer cash ledger table with running balance accurate down to ₹0.01 paise.
  - [x] **Backend API Extensions** (`src/api/routers/`):
    - `POST /portfolio/squareoff/{symbol}` (`src/api/routers/portfolio.py`): Automatically computes net quantity and executes an opposite closing market order against resting book depth.
    - `GET /ledger/t-accounts` & `GET /ledger/contract-notes` (`src/api/routers/ledger.py`): Delivers aggregated Double-Entry T-Accounts equilibrium and statutory charge summaries.
    - Enhanced `PATCH /orders/{order_id}` and `DELETE /orders/{order_id}` to resolve symbol automatically if omitted from query parameters.
  - [x] **Verification Suite**: 4 dedicated integration tests passing (`test_phase7d_portfolio_orders_ledger.py`), full Next.js production build (`npm run build`) succeeded with 0 errors across all routes.
- [x] **Phase 7E: Agentic AI Copilot & Risk Alerts** *(COMPLETED)*
  - [x] Full-width tabbed Copilot workspace (`/copilot`), Policy Approval / Rejection cards, live citations, What-If simulation sandbox, and unprompted risk alert stream.
  - [x] 84 pytest tests passing (100% test pass rate), Next.js build clean with 0 errors.
- [x] **Phase 7F: Integration & Polish & 4 Key Judge Demo Moments** *(COMPLETED)*
  - [x] **Demo Moment 1 (500-Share Book Walk)**: Seeded 4-level ask depth, verified 500-share market order execution across levels, VWAP computation, 4 atomic trade legs, contract note taxes down to ₹0.01 paise, and balanced ledger.
  - [x] **Demo Moment 2 (Crash Recovery Reload)**: Cold memory wipe simulated via `/system/crash-replay`, durable event log re-hydration verified with ₹0.00 discrepancy.
  - [x] **Demo Moment 3 (Policy Gate Block vs Approval)**: Verified agent firewall blocks oversized order (> ₹50,000) with detailed statutory rationale, and routes compliant trades through human approval card for one-click execution.
  - [x] **Demo Moment 4 (Autonomous Alert Drop)**: Market drop tick (-5.5%) simulated via `/system/simulate-drop`, verified unprompted `AGENT_ALERT` dispatch over WebSockets with Mistral AI brief in < 2 seconds.
  - [x] **UI Judge Demo Control Bar** (`frontend/src/components/layout/JudgeDemoBar.tsx`): Persistent, floating control bar with one-click triggers for all 4 key demo moments.
  - [x] **Verification Suite**: 88 pytest tests all passing (100% test pass rate across all unit and integration tests), Next.js 15 production build passing with 0 errors.
- [x] **021 Market Integration Phase 1: 021 Client Auth & In-Memory Instrument Master** *(COMPLETED)*
  - [x] **021 Configuration** (`src/market_data/zero21/config.py`, `.env.example`): Added `ZERO21_UCC`, `ZERO21_PASSWORD`, `ZERO21_BASE_URL`, and `ZERO21_WS_BASE_URL`.
  - [x] **High-Speed Async 021 Client** (`src/market_data/zero21/client.py`): Implemented `Zero21Client` with single-live-token rule enforcement, connection pooling (`httpx.AsyncClient`), disk token cache (`data/zero21_token.json`), concurrency-safe login lock, and automatic 401 re-auth on ephemeral key request.
  - [x] **Sub-Microsecond In-Memory Instrument Master** (`src/market_data/zero21/instruments.py`): In-memory O(1) token and symbol indexing, preloaded seeds (RELIANCE, TCS, INFY, HDFCBANK), Gzip decompression of `GET /instruments` CSV (~105k contracts), and atomic disk caching (`data/instruments.csv`).
  - [x] **Verification Suite**: 6 new unit tests all passing across `test_zero21_client.py` and `test_zero21_instruments.py`.
- [x] **021 Market Integration Phase 2: Binary WebSocket Client & Packet Parser** *(COMPLETED)*
  - [x] **Zero-Allocation Binary Packet Parser** (`src/market_data/zero21/parser.py`): High-speed `struct` decoder for Big-Endian binary frames: TC 1 (LTP 12B + 5B snapshot 'o'/'c' open/close), TC 3 (220-byte NSECM full depth with all 10 bid/ask levels, OHLC, volume, and trade times), TC 10 (Heartbeat skip), and multi-packet frame slicing.
  - [x] **Resilient WebSocket Feed Handler** (`src/market_data/zero21/feed.py`): Production-grade client handling dynamic ephemeral keys, exponential backoff reconnects, 08:00 IST server reset auto-recovery, subscription management, and direct integration with `SequenceManager` for deduplication.
  - [x] **Gateway Integration** (`src/market_data/gateway.py`): Embedded `Zero21MarketFeedHandler` into `MarketDataGateway` with dual live/replay mode switching.
  - [x] **Verification Suite**: 9 new unit tests passing across `test_zero21_binary_parser.py` and `test_zero21_feed_handler.py`.
- [x] **021 Market Integration Phase 3 & 4: Official Test Harness REST API Contract** *(COMPLETED)*
  - [x] **021 REST API Router** (`src/api/routers/zero21_contract.py`): Implemented exact endpoints required by hackathon test harness (`/orders`, `/orders/{id}`, `/trades`, `/orders/{id}/trades`, `/portfolio/positions`, `/portfolio/holdings`, `/auth/token`, `/websocket/ephemeral-key`, `/instruments`) mounted on `/api/developer-api/v1` and `/developer-api/v1`.
  - [x] **Unit & Protocol Adherence**: Strict paise integer precision (`price`, `triggerPrice`, `netPrice`), signed quantities (+ for buy, - for sell), token <-> symbol resolution, RL/SL books, and standard envelope responses `{"data": ..., "success": true, "error": null}`.
  - [x] **Verification Suite**: 4 comprehensive integration tests passing in `tests/integration/test_zero21_api_contract.py`.




---

## 4. Phase 1 Implementation Details

### Files Created & Modules Implemented

1. **`src/common/types.py`**:
   - `Side`: `BUY`, `SELL`
   - `OrderType`: `LIMIT`, `MARKET`, `SL`, `SL_M`
   - `OrderStatus`: `PENDING`, `OPEN`, `PARTIALLY_FILLED`, `FILLED`, `CANCELLED`, `REJECTED`
   - `ProductType`: `CNC` (Cash and Carry / Delivery), `MIS` (Margin Intraday Square-off)
   - `TimeInForce`: `DAY`, `IOC`

2. **`src/common/money.py`**:
   - `to_money(val)`: Quantizes to `0.01` with `ROUND_HALF_UP`.

3. **`src/common/clock.py`**:
   - `Clock`: Injectable, deterministic timestamp provider for reproducible replay and testing.

4. **`src/common/exceptions.py`**:
   - `TradingEngineException`, `InvalidOrderStateTransitionError`, `InvalidOrderError`, `OrderNotFoundError`.

5. **`src/core/models.py`**:
   - `TradeEvent`: Option B order leg event (`trade_id`, `order_id`, `symbol`, `side`, `price`, `quantity`, `counterparty_order_id`, `is_maker`, `timestamp`).
   - `MatchRecord`: Exchange-level atomic execution linking maker and taker with child leg trade events.
   - `Order`: Pydantic domain model with active/terminal properties, validation, and auto-initialization of remaining quantity.
   - `MatchResult`: Aggregates the taker order, list of atomic matches, and emitted trade events.

6. **`src/core/state_machine.py`**:
   - `OrderStateMachine`: Strict transition graph (`VALID_TRANSITIONS`). Enforces invariants (e.g. `FILLED` requires `remaining_qty == 0`, `PARTIALLY_FILLED` requires `remaining_qty > 0` and `filled_qty > 0`). Accurately calculates volume-weighted average fill price (VWAP) across successive fills.

7. **`src/core/order_book.py`**:
   - `SymbolOrderBook`: In-memory priority queue per symbol.
   - Bids heap: `(-price, created_at, sequence_id, order_id)` (highest price, earliest time).
   - Asks heap: `(price, created_at, sequence_id, order_id)` (lowest price, earliest time).
   - O(1) cancel via tombstoning and lazy pruning on peek/pop.
   - `get_market_depth(levels=5)`: Aggregated L2 depth generation (prepared for Phase 2 L2 live ticks).

8. **`src/core/matching_engine.py`**:
   - `DeterministicMatchingEngine`: Multi-level book walking, crossing checks, execution price determination (passive maker price), atomic match creation, order state transitions, IOC remainder handling for Market orders.

9. **`tests/unit/` (15 Unit Tests All Passing)**:
   - `test_state_machine.py`: Full lifecycle, illegal terminal transitions, quantity guard checks, VWAP fill price accuracy.
   - `test_order_book.py`: Bid price-time priority, ask price-time priority, lazy cancellation pruning, market depth aggregation.
   - `test_matching_engine.py`: **Phase 1 Exit Criteria unit test**, multi-level book walks, Market order IOC exhaustion, passive maker price priority, non-crossing resting orders, cancellation via engine, successive partial fills.

---

## 5. Minute-by-Minute Action Log

| Timestamp | Phase | Action Description | Status |
| :--- | :--- | :--- | :--- |
| **2026-10-08 07:58** | Research | Analyzed `docs/plan.txt` and `docs/ps.txt`. Identified architectural constraints (monolith over microservices, deterministic engine vs agentic layer). | Done |
| **2026-10-08 08:04** | Planning | Formulated questions on Decimal vs Paise, TradeEvent leg structure, market order policy, and Phase 1 scope. User approved Decimal, Option B trade legs, Option A IOC market fill, and monolith architecture. | Done |
| **2026-10-08 08:05** | Setup | Initialized Python 3.13 virtual environment (`.venv`), created `requirements.txt`, installed FastAPI, Pydantic, SQLAlchemy, asyncpg, Pytest. | Done |
| **2026-10-08 08:06** | Setup | Created `docs/progress_tracker.md` to persist detailed execution status for subsequent agents. | Done |
| **2026-10-08 08:06** | Monolith Scaffold | Created directory tree: `src/{common,core,market_data,risk,portfolio,ledger,scheduler,storage,events,api,agentic}` and `tests/{unit,integration}` with package `__init__.py` files. | Done |
| **2026-10-08 08:06** | Config | Created `pytest.ini` with `pythonpath = . src` and async configuration. | Done |
| **2026-10-08 08:06** | Phase 1 Core | Implemented `src/common/types.py`, `src/common/money.py`, `src/common/clock.py`, and `src/common/exceptions.py`. | Done |
| **2026-10-08 08:07** | Phase 1 Core | Implemented `src/core/models.py` (`Order`, `TradeEvent`, `MatchRecord`, `MatchResult`). | Done |
| **2026-10-08 08:07** | Phase 1 Core | Implemented `src/core/state_machine.py` with transition matrix, invariant guards, and cumulative VWAP updates. | Done |
| **2026-10-08 08:07** | Phase 1 Core | Implemented `src/core/order_book.py` with price-time priority heaps, sequence counters, lazy tombstone pruning, and L2 depth builder. | Done |
| **2026-10-08 08:08** | Phase 1 Core | Implemented `src/core/matching_engine.py` with deterministic multi-level matching, maker price rules, leg trade events, and IOC market order cancellation. | Done |
| **2026-10-08 08:08** | Phase 1 Test | Created comprehensive test suites: `test_state_machine.py`, `test_order_book.py`, `test_matching_engine.py`. | Done |
| **2026-10-08 08:09** | Phase 1 Verification | Ran `pytest -v`. Fixed remaining_qty initialization when instantiating OPEN orders directly. All 15 unit tests passed in 0.21s, fully satisfying Phase 1 Exit Criteria. | Done |
| **2026-10-08 08:10** | Progress Update | Updated `docs/progress_tracker.md` with complete Phase 1 delivery details and transition notes for Phase 2. | Done |
| **2026-10-08 08:18** | Phase 2 Planning | Formulated questions on charges schedule, double-entry ledger style, database approach, and MTM margin leverage. User selected standard discount broker model, dual-layer T-accounts, direct SQLAlchemy/PostgreSQL, and conservative MTM leverage. | Done |
| **2026-10-08 08:24** | Phase 2 Core | Implemented `src/ledger/charges.py` (`IndianRegulatoryChargesCalculator`) with exact paise precision. Added unit tests in `test_charges_calculator.py`. | Done |
| **2026-10-08 08:25** | Phase 2 Core | Implemented `src/risk/margin.py` and `src/risk/engine.py` (`PreTradeRiskEngine`, `MarginCalculator`). Added unit tests in `test_risk_margin.py`. | Done |
| **2026-10-08 08:26** | Phase 2 Core | Implemented `src/portfolio/models.py` and `src/portfolio/position_manager.py` (VWAP, Realized P&L, MTM). Added unit tests in `test_positions_pnl.py`. | Done |
| **2026-10-08 08:27** | Phase 2 Core | Implemented `src/ledger/models.py` and `src/ledger/journal.py` (`ImmutableDoubleEntryLedger`, T-Accounts). Added unit tests in `test_double_entry_ledger.py`. | Done |
| **2026-10-08 08:38** | Phase 2 DB | Configured `src/storage/database.py` (Supabase PostgreSQL / asyncpg with SQLite fallback) and created SQLAlchemy models in `src/storage/models/`. Added unit tests in `test_storage_models.py`. | Done |
| **2026-10-08 08:42** | Phase 2 Exit Criteria | Ran all 31 pytest tests. All passed in 0.62s. Exit criteria (Buy 100 @ 100, Sell 100 @ 110 MIS -> Gross ₹1,000, Charges ₹11.26, Running balance ₹50,988.74) fully verified down to exact paisa. | Done |
| **2026-10-08 12:26** | Phase 3 Research | Researched `nsepython` and NSE public endpoints (`api/quote-equity?symbol=`). Identified exact nested structure (`marketDeptOrderBook.bid`, `marketDeptOrderBook.ask`, `priceInfo.lastPrice`). | Done |
| **2026-10-08 12:37** | Phase 3 Core | Extended `OrderStatus` with `TRIGGER_PENDING` and updated `OrderStateMachine` and `Order` models to support Stop-Loss (`SL`) and Stop-Loss Market (`SL_M`). | Done |
| **2026-10-08 12:38** | Phase 3 Core | Implemented `src/market_data/models.py` (`MarketDepth`, `DepthLevel`, `FeedHealth`, `FeedStatus`) and `src/market_data/normalizer.py` (`MarketDepthNormalizer`). | Done |
| **2026-10-08 12:38** | Phase 3 Core | Implemented `src/market_data/sequence_manager.py` with duplicate detection, out-of-order rejection, sequence gap detection, and rolling signature windows. | Done |
| **2026-10-08 12:38** | Phase 3 Core | Implemented `src/market_data/replay_engine.py` for async `.jsonl` streaming with configurable time pacing. | Done |
| **2026-10-08 12:39** | Phase 3 Core | Implemented `src/market_data/live_feed.py` (`LiveNSEFeedHandler`) using async `httpx` with session cookies and non-crashing network recovery. | Done |
| **2026-10-08 12:39** | Phase 3 Core | Implemented `src/market_data/depth_matcher.py` (`MarketDepthMatcher`) bridging L2 depth to SL/SL-M triggers and resting limit order crossings. | Done |
| **2026-10-08 12:39** | Phase 3 Core | Implemented `src/market_data/gateway.py` (`MarketDataGateway`) unifying Live and Replay modes. | Done |
| **2026-10-08 12:44** | Phase 3 Verification | Added unit tests (`test_market_depth_normalizer.py`, `test_sequence_resilience.py`, `test_replay_engine.py`, `test_stop_loss_triggering.py`) and integration test (`test_market_gateway_replay_matching.py`). All 39 tests passing! | Done |
| **2026-10-08 12:54** | nsepython Direct Integration | Installed official `nsepython` package into `.venv`, updated `requirements.txt`, updated `MarketDepthNormalizer` to parse `nse_quote` (`equityResponse.orderBook` buyPrice1..5 / sellPrice1..5), integrated `LiveNSEFeedHandler` with direct `nsepython.nse_quote()` async calls. Verified live RELIANCE quote retrieval (LTP ₹1,175.70, Bid ₹1,175.60, Ask ₹1,175.70, Spread ₹0.10). All 39 tests passing! | Done |
| **2026-10-08 21:55** | Phase 7B Frontend Monolith | Scaffolding Next.js 15 (React 19, TypeScript, Tailwind CSS v4, Lucide icons) in `frontend/`, configured shadcn/ui components (`card`, `badge`, `tabs`, `table`, etc.), Zustand store, streaming WebSocket hook, pure white theme sidebar and top header with Demo Toggle Switch. Verified production build passed with 0 errors. | Done |




---

## 6. Phase 2 Implementation Details

### Files Created & Modules Implemented

1. **`src/ledger/charges.py`**:
   - `ChargesConfig`: Configurable fee schedule matching SEBI/NSE rates (Brokerage, STT, Exchange Turnover, SEBI Fees, Stamp Duty, GST).
   - `IndianRegulatoryChargesCalculator`: Pure deterministic calculation quantized to exact paise (`0.01` with `ROUND_HALF_UP`).

2. **`src/risk/margin.py` & `src/risk/engine.py`**:
   - `MarginCalculator`: CNC 100% upfront margin + charges; MIS 20% margin (5x leverage) + charges.
   - `PreTradeRiskEngine`: Validates margin and delivery holdings before order placement. Blocks margin on limit order placement, releases margin upon cancellation, and adjusts margin upon fills.

3. **`src/portfolio/models.py` & `src/portfolio/position_manager.py`**:
   - `Position` & `Holding`: Real-time position tracking per account, symbol, and product.
   - `PositionManager`: Cumulative VWAP on position expansion, Realized P&L on partial/full exits, short sale support, position reversal handling, and real-time MTM against market LTP.

4. **`src/ledger/models.py` & `src/ledger/journal.py`**:
   - `ImmutableDoubleEntryLedger`: Dual-layer accounting.
   - Customer Cash Journal: Chronological append-only entries with running balance (`CASH_DEPOSIT`, `TRADE_SETTLEMENT`, `BROKERAGE_CHARGE`, `STT_CHARGE`, `EXCHANGE_TURNOVER_CHARGE`, `SEBI_TURNOVER_CHARGE`, `STAMP_DUTY_CHARGE`, `GST_CHARGE`, `REALIZED_PNL`).
   - Double-Entry T-Accounts: Verified balancing across `USER_CASH`, `BROKER_REVENUE`, `STT_PAYABLE`, `EXCHANGE_FEES_PAYABLE`, `SEBI_FEES_PAYABLE`, `STAMP_DUTY_PAYABLE`, `GST_PAYABLE`, `EXCHANGE_SETTLEMENT`. Enforces `sum(debits) == sum(credits)`.

5. **`src/storage/database.py` & `src/storage/models/`**:
   - Async SQLAlchemy engine supporting Supabase PostgreSQL (`postgresql+asyncpg://`) with fallback for local testing.
   - Declarative models: `AccountModel`, `OrderModel`, `TradeModel`, `PositionModel`, `HoldingModel`, `CustomerCashEntryModel`, `DoubleEntryTransactionModel`, `DoubleEntryLegModel`.

6. **`src/core/trade_service.py`**:
   - Orchestrates the full financial flow: Order -> Risk Margin Check -> Matching Engine -> Charges Calculation -> Position & P&L Update -> Ledger Entries.

7. **Verification & Tests (31 Unit & Integration Tests Passing)**:
   - `test_charges_calculator.py`: 4 tests passing (MIS buy/sell, CNC buy, ₹20 brokerage cap).
   - `test_risk_margin.py`: 4 tests passing (CNC vs MIS margin, pre-trade rejections, block/release lifecycle).
   - `test_positions_pnl.py`: 3 tests passing (VWAP, short-covering, MTM P&L).
   - `test_double_entry_ledger.py`: 3 tests passing (deposit, charges itemization, P&L credit/debit, T-account balance).
   - `test_storage_models.py`: 1 test passing (async table creation and persistence).
   - `test_financial_engine_roundtrip.py`: **Phase 2 Exit Criteria fully satisfied**.

---

## 8. Phase 6 Implementation Details (Proactive Features, Simulation & MIS Square-off)

### Modules & Files Implemented

1. **Deterministic MIS Auto Square-off Engine (`src/settlement/mis_squareoff.py`)**:
   - `MISSquareOffManager`: Auditable settlement service executing zero-LLM liquidation of open MIS positions.
   - Guaranteed liquidity: Injects counterparty resting maker liquidity at current market price if book depth is exhausted in paper mode.
   - Injects closing market orders into `TradeExecutionService`, books realized P&L, records double-entry ledger entries, and reduces position to 0.
   - Emits `MIS_SQUAREOFF_TRIGGERED` and `MIS_SQUAREOFF_COMPLETED` domain events.

2. **Trading Scheduler Service (`src/scheduler/service.py`)**:
   - `TradingSchedulerService`: APScheduler (`AsyncIOScheduler`) managing automated recurring market tasks.
   - Configured with daily cron trigger for 15:20:00 IST (`Asia/Kolkata`).
   - Supports manual and simulation-driven execution via `trigger_now()`.
   - Wired directly into FastAPI lifespan in `src/api/app.py`.

3. **What-If Simulation Engine (`src/simulation/`)**:
   - `src/simulation/models.py`: DTOs for `SimulationRequest`, `PriceScenario`, `HypotheticalOrder`, `SimulatedPosition`, and `SimulationResult`.
   - `src/simulation/engine.py` (`WhatIfSimulationEngine`): Creates in-memory snapshot clone of active positions and account state, runs exact MTM math, regulatory charges, and margin rules without mutating live trading state.
   - Natural language parsing regex: Handles prompts like *"What if TCS falls 6%?"* or *"What happens if Reliance drops 8%?"*.
   - REST Endpoints (`src/api/routers/simulation.py`): `POST /api/v1/agent/simulate` and `POST /agent/simulate`.

4. **Autonomous Event-Driven Monitor (`src/agentic/monitor/`)**:
   - `src/agentic/monitor/rules.py`:
     - `RiskThresholdEvaluator`: Evaluates `UNREALIZED_LOSS > 5%` and `TICK_PRICE_DROP > 3%`.
     - `DebounceTracker`: Enforces 60-second cooldown per symbol/condition with an immediate re-trigger rule for incremental drops $\ge 2\%$.
   - `src/agentic/monitor/event_monitor.py` (`AutonomousEventMonitor`): Asynchronous background worker subscribed to in-memory Event Bus. Upon threshold breach, fires an async LLM prompt via Mistral AI (`ChatMistralAI` / fallback), synthesizes a crisp institutional risk brief, and publishes `DomainEvent(event_type="AGENT_ALERT")` to the Event Bus.
   - Real-time Dispatch (`src/events/consumers/ws_broadcaster.py`): WebSocket worker automatically broadcasts `AGENT_ALERT` to connected WebSocket clients in real-time (< 50ms).

5. **REST Endpoints Added**:
   - `POST /api/v1/agent/simulate` & `POST /agent/simulate`: What-if simulation endpoint.
   - `POST /settlement/mis-squareoff`: Endpoint to trigger deterministic MIS square-off.

6. **Verification & Tests (68 Tests Passing Across Repository)**:
   - `tests/unit/test_mis_squareoff.py`: 3 tests passing (long square-off, CNC left untouched, scheduler lifecycle).
   - `tests/unit/test_simulation_engine.py`: 3 tests passing (percentage drop math, prompt parsing, hypothetical orders with charges).
   - `tests/unit/test_event_monitor.py`: 3 tests passing (cooldown/debounce logic, threshold evaluator, autonomous alert publish).
   - `tests/integration/test_phase6_proactive_alert.py`: **Phase Exit Criteria fully verified** (simulated 6% drop in held stock popped up structured alert on WebSocket in < 2 seconds).


---

## 9. Phase 7E Implementation Details (AI Copilot & Risk Alerts)

### Overview
Phase 7E establishes the complete decoupled **Intelligence Plane** in the monolithic application, seamlessly integrating conversational multi-source equity research, strict Policy Gate trade authorization, interactive What-If scenario simulations, and the real-time proactive risk alert feed.

### Modules Created & Enhanced

1. **Frontend UI Components (`frontend/src/components/copilot/`)**:
   - `CopilotChat.tsx`: Multi-turn conversational chat stream with quick prompt pills, automatic scroll-to-bottom, streaming thinking indicators, and clear conversation management.
   - `ChatMessage.tsx`: Chat bubble rendering with specialist routing badges (`Research Specialist`, `Portfolio Specialist`, `Trade Proposer Agent`), real citations, and inline policy cards.
   - `WebCitationsList.tsx`: Verified news citation card grid presenting headlines, sources (DuckDuckGo, Google News, Moneycontrol), publication timestamps, snippets, and verified external links.
   - `PolicyApprovalCard.tsx`: Interactive human approval card for compliant proposed trades. Displays symbol, side, order type, product type, quantity, reference price, and estimated value, alongside exact itemized statutory charges (Brokerage, STT, Exchange turnover, SEBI fee, Stamp duty, GST) and margin requirements. Features direct one-click execution (`Approve & Execute Trade`) routing into the deterministic matching engine.
   - `PolicyRejectionCard.tsx`: Safety policy firewall notice for over-limit proposals (e.g. order value > ₹50,000, loss > ₹2,000, or insufficient margin), highlighting the violated hard limit rule and reason.
   - `WhatIfSandbox.tsx`: Dual-mode simulation workspace supporting both natural language prompts (*"What if TCS falls 6%?"*) and visual interactive shock sliders (-25% to +25%). Evaluates cloned account state without mutating live data, displaying side-by-side projected MTM P&L delta, margin utilization, and statutory levies.
   - `ProactiveAlertFeed.tsx`: Live WebSocket-connected notification feed displaying unprompted risk alerts (Tick Drop > 3%, Position Loss > 5%) with Mistral AI institutional briefs and a dedicated judge demo button (**"Simulate Market Drop (-5.5%)"**).
   - `frontend/src/app/copilot/page.tsx`: Full-width institutional Tabbed Workspace organizing `[Conversational Copilot]`, `[What-If Scenario Sandbox]`, and `[Proactive Risk Alerts]`.

2. **Backend API Polish (`src/api/routers/agent.py` & `src/agentic/graph.py`)**:
   - Extended `AgentChatRequest` with `query` and `prompt` aliases.
   - Extended `AgentChatResponse` with `agent_routed`, `citations`, `policy_result`, and `proposed_order`.
   - Connected `trade_service` into `AgentPolicyEngine` to validate real account balance for pre-trade margin checks.
   - Enriched `POST /api/v1/agent/execute-proposed` with order status, fill quantity, and trade leg count.
   - Extended `SimulateDropRequest` in `src/api/routers/system.py` to support both `drop_percentage` and `drop_pct`.

3. **Verification & Test Suite**:
   - `tests/integration/test_phase7e_copilot_and_approval.py`: 4 dedicated integration tests covering research citations, policy firewall rejection, compliant proposal execution, What-If simulation, and simulated drop injection.
   - Full test suite: **84 passed across all unit and integration tests (100% pass rate)**.
   - Frontend build: **Next.js 15 production build (`npm run build`) succeeded with 0 errors across all routes**.

---

## 11. 021 Trade Market Integration — Phase 1 Implementation Details

### Overview
Phase 1 establishes the foundational client layer for integrating the **021 Trade Developer Sandbox** live market data ecosystem into the Paper Trading Engine, while strictly adhering to problem statement rule **021-02** (zero simulated orders ever transmitted to the broker).

### Modules Created

1. **Configuration Layer (`src/market_data/zero21/config.py`)**:
   - `Zero21Config`: Pydantic settings loading `ZERO21_UCC`, `ZERO21_PASSWORD`, `ZERO21_BASE_URL` (`https://devapi.021.trade/api/developer-api/v1`), and `ZERO21_WS_BASE_URL` (`wss://devapi.021.trade/api/developer/websocket/market`).
   - `.env.example`: Updated with documented 021 credential templates.
   - Safe defaults and fallback handling ensuring the application never crashes if credentials are unset.

2. **Ultra-Low Latency REST Client (`src/market_data/zero21/client.py`)**:
   - `Zero21Client`: Async client leveraging persistent `httpx.AsyncClient` connection pooling for sub-millisecond execution.
   - **Single Live Token Rule Enforcement**: Caches active `accessToken` in memory and persists to disk (`data/zero21_token.json`). Re-uses token across script restarts and cold boots until its 5:00 AM IST expiration, preventing premature session revocations.
   - **Concurrency Safety**: `asyncio.Lock` prevents duplicate simultaneous login handshakes during tick bursts or worker initialization.
   - **Ephemeral Key Pipeline**: Handles `GET /websocket/ephemeral-key` requests with automatic token renewal and single-retry transparent recovery on HTTP 401.
   - **Gzip Instruments Streaming**: Ingests compressed CSV streams directly from `GET /instruments`.

3. **Sub-Microsecond In-Memory Instrument Master (`src/market_data/zero21/instruments.py`)**:
   - `InstrumentInfo`: Lightweight Python `__slots__` dataclass storing token, exchange, tick size (paise), circuit limits (paise), board lot quantity, symbol, and ISIN.
   - `InstrumentMaster`: High-speed registry providing $O(1)$ (< 1 microsecond) dual lookups (`get_by_token`, `get_by_symbol`, `symbol_to_token`, `token_to_symbol`).
   - **Cold-Start Resilience & Fallback Seeds**: Preloads liquid market contracts (`RELIANCE` token 2885, `TCS` token 11536, `INFY` token 1594, `HDFCBANK` token 1333) so the system boots instantaneously with zero external dependencies.
   - **Gzip Decompression & Local Caching**: Downloads and caches ~105,000 contracts to `data/instruments.csv`. Re-uses existing cache on server restart, slashing boot latency from seconds to < 50 milliseconds.

4. **Verification & Test Suite**:
   - `tests/unit/test_zero21_client.py`: Verifies login envelope handling, single-token reuse, disk cache persistence, ephemeral key acquisition, and automatic 401 recovery.
   - `tests/unit/test_zero21_instruments.py`: Verifies seed preloading, $O(1)$ token/symbol indexing, CSV parsing with edge-case tolerance, and Gzip decompression.

---

## 12. 021 Trade Market Integration — Phase 2 Implementation Details

### Overview
Phase 2 implements the production-grade, low-latency Big-Endian binary parser and WebSocket streaming client for the **021 Trade Developer Sandbox** market data feed, directly feeding live Top-5 bids/asks, LTP, volume, and OHLC into the in-memory matching and risk engines.

### Modules Created & Enhanced

1. **Zero-Allocation Binary Packet Parser (`src/market_data/zero21/parser.py`)**:
   - `BinaryPacketParser`: Native `struct.unpack_from` Big-Endian decoder processing incoming byte frames in sub-microsecond time.
   - **TC 1 (LTP Packet, 12 Bytes)**: Extracts Exchange code, Token, and LTP (paise to Decimal Rupees). Decodes optional 5-byte snapshot frames (`'o'` for Open price and `'c'` for Close price).
   - **TC 3 (NSECM Full Depth, 220 Bytes)**:
     - Header (64 bytes): Token, LTP, Last Trade Quantity, Average Traded Price, Cumulative Volume, Total Buy/Sell Quantities, Close, Open, High, Low, and 1980-epoch Last Trade Time.
     - Market Depth (140 bytes): Unpacks all 10 order book levels (Top 5 Bids + Top 5 Asks) with exact Quantity (8B), Price in paise (4B), and Orders count (2B).
     - Tail (16 bytes): Indicative Close, Indicative Imbalance, and Exchange Timestamp.
   - **TC 10 (Heartbeat Packet, 2 Bytes)**: Automatically detected `[0x00, 0x0A]` frames and skipped without allocation.
   - **Multi-Packet Slicing**: Dynamically handles frames packing multiple packets back-to-back within a single network buffer.

2. **Persistent WebSocket Feed Handler (`src/market_data/zero21/feed.py`)**:
   - `Zero21MarketFeedHandler`: Persistent background worker using `websockets.connect` to `wss://devapi.021.trade/api/developer/websocket/market?token=<ephemeral_key>`.
   - **Resilience & Reconnect Architecture**:
     - Exponential backoff reconnects upon socket disconnect.
     - Automatic fresh ephemeral key acquisition on reconnects.
     - Handles 08:00 IST daily exchange socket drops with automatic resubscription.
     - Built-in ping/pong keep-alives (20s interval / 30s timeout).
   - **Sequence & Deduplication Integration**: Forwards parsed `MarketDepth` updates through `SequenceManager.validate_and_record()` to drop duplicated and out-of-order ticks.
   - **Zero-Crash Graceful Boundary**: If network drops or credentials are unset, handler idles in disconnected state without disrupting order matching or API services.

3. **Gateway Wiring (`src/market_data/gateway.py`)**:
   - Integrated `Zero21MarketFeedHandler` into `MarketDataGateway`.
   - Live mode dynamically subscribes target instruments and routes parsed ticks into `DepthMatcher` to trigger Stop-Loss orders and cross resting limit orders.

4. **Verification & Test Suite**:
   - `tests/unit/test_zero21_binary_parser.py`: Verifies TC 1 (LTP), TC 1 snapshot open/close prices, TC 10 heartbeat skipping, TC 3 220B NSECM 10-level depth parsing, and multi-packet framing.
   - `tests/unit/test_zero21_feed_handler.py`: Verifies instrument subscriptions, binary tick dispatch, deduplication filtering via `SequenceManager`, and non-crashing start/stop lifecycle.

---

## 13. 021 Trade Market Integration — Phases 3 & 4 (Official Test Harness REST API Contract)

### Overview
Phases 3 & 4 implement the exact REST API contract defined by the **021 Trade Developer Sandbox**, enabling the hackathon's automated testing harness to drive the Paper Trading Engine end-to-end. The engine performs all order matching, risk calculation, position management, and ledger accounting internally, strictly abiding by Rule 021-02 (no simulated orders sent to the external broker).

### Modules Created & Enhanced

1. **Official 021 REST Contract Router (`src/api/routers/zero21_contract.py`)**:
   - Mounted at both `/api/developer-api/v1` and `/developer-api/v1` to match the exact URL schemas used by the testing harness and participant scripts.
   - **Units & Formatting**:
     - Prices received and emitted strictly as **integers in paise** ($1.00 = 100 paise).
     - Quantities signed: positive for BUY, negative for SELL.
     - Tokens mapped dynamically to underlying symbols via `InstrumentMaster`.
     - Standard envelope responses: `{"data": ..., "success": true, "error": null}`.

2. **Endpoints Implemented**:
   - `POST /auth/token`: Mock authentication providing active `accessToken` envelopes so test runners can authenticate against the local server.
   - `GET /websocket/ephemeral-key`: Delivers ephemeral key tokens.
   - `GET /instruments`: Streams decompressed/cached instruments CSV (~105,000 rows).
   - `POST /orders`:
     - Accepts `token`, `qty`, `price` (paise), `book` (`RL`/`SL`), `product` (`INTRADAY`/`CNC`), `validity` (`Day`/`IOC`), and `trigger` (paise).
     - Validates circuit limits and tick sizes.
     - Executes orders in-memory against resting L2 liquidity.
     - On insufficient margin / risk rejection, returns standard envelope: `{"data": null, "success": false, "error": "Insufficient funds: ..."}`.
   - `PUT /orders/{order_id}`: Full state order modification (quantity and price in paise).
   - `DELETE /orders/{order_id}`: Asynchronous order cancellation with instant margin unblocking.
   - `GET /orders`: Returns plain JSON array of today's orders (newest first) with `orderId`, `token`, `qtyRemaining`, `qtyTraded`, `price` (paise), and status (`Executed`, `Pending`, `Cancelled`).
   - `GET /orders/{order_id}`: Returns 1-element array matching single order or 404.
   - `GET /trades` & `GET /orders/{order_id}/trades`: Returns executed trade fills in paise.
   - `GET /portfolio/positions`: Returns position records with `netQuantity`, `netPrice` (paise), `squareOffQuantity`, and `longPosition` boolean.
   - `GET /portfolio/holdings`: Returns CNC delivery demat holdings with average buy price in paise.

3. **Virtual Account Initialization**:
   - Accounts are automatically provisioned with the official **₹10,00,000 (10 Lakhs)** virtual funds on first encounter.

4. **Verification & Test Suite**:
   - `tests/integration/test_zero21_api_contract.py`: 4 comprehensive integration tests covering:
     - Authentication, ephemeral key, and instruments download.
     - Full order lifecycle (Place RL limit order -> List orders -> Get single order -> Modify order -> Cancel order).
     - Trade execution, order fill book walks, positions, and holdings.
     - Pre-trade risk rejection on oversized margin requirements.




---

## 9. Live Core Engine Rigorous Audit, Load & Latency Verification

Executed end-to-end on the live running server (`http://localhost:8000`) via `tests/test_harness_rigorous_live.py`:
- **L1 Delivery (CNC)**: Full order lifecycle (Place -> Modify -> Cancel), maker-taker match execution, trade generation, delivery holdings inventory (`freeQty: 30`, avg price ₹2500.00).
- **L2 Depth Fills & SL**: Stop-Loss orders resting in `TRIGGER_PENDING`, market depth retrieval, multi-level depth book walks.
- **L3 MIS Leverage & Auto Square-Off**: Pre-trade margin shortage rejection on ₹5 Crore order against ₹10 Lakh funds, 5x MIS leverage (20% margin), 15:20 IST auto square-off closing all open intraday positions to 0.
- **The Ledger Never Lies**: Double-entry balance $\Sigma \text{Debits} == \Sigma \text{Credits}$ with **₹0.00 discrepancy** across all accounts.
- **Cold Crash Recovery**: Process crash simulation re-hydrating in-memory state in **676.90 ms** with **₹0.00 post-recovery drift**.
- **Load & Concurrency**: 20 concurrent trading accounts, 200 operations, **205.18 req/sec** throughput, **100% success rate**.
- **Latency Benchmarks**: Order placement **p50 = 2.95 ms** (p95 = 5.19 ms), order cancellation **p50 = 2.80 ms** (p95 = 3.87 ms).
- **Audit Report Generated**: Full report available at [`docs/LIVE_CORE_ENGINE_AUDIT_AND_TEST_REPORT.md`](file:///d:/My_Space/SYRUS_7/docs/LIVE_CORE_ENGINE_AUDIT_AND_TEST_REPORT.md).

---

## 10. Market Feed Misbehavior & Resilience Audit (021 Sandbox Compliance)

Executed end-to-end against live running server (`http://localhost:8000`) via [`scripts/test_feed_misbehavior_live.py`](file:///d:/My_Space/SYRUS_7/scripts/test_feed_misbehavior_live.py) and unit suite [`tests/unit/test_feed_resilience.py`](file:///d:/My_Space/SYRUS_7/tests/unit/test_feed_resilience.py):
- **Problem Statement Rule**: *"The market feed misbehaves on purpose. Expect issues such as out-of-order ticks, duplicate ticks, feed drops, tick bursts, and so on."*
- **Duplicate Ticks**: 10 duplicate ticks injected; all 10 detected and dropped by `SequenceManager` rolling signature window ($O(1)$).
- **Out-of-Order Ticks**: 5 inverted timestamp/backwards sequence packets injected; all dropped before reaching matching engine.
- **Sequence Gaps**: +15 sequence number jump injected; tracked in `sequence_gaps_detected` metrics without stalling engine.
- **Tick Microbursts**: 100 rapid ticks injected in 2.06 seconds (~20 ms/tick); zero buffer drops or latency spikes.
- **Order Engine Immunity**: Placed resting BUY LIMIT order; injected dirty/corrupt ticks; verified order remained safely `OPEN` without false execution.
- **Feed Drops & Reconnection**: Cleanly toggled between `REPLAY` and `LIVE` feeds; verified zero process crashing and seamless state restoration.
- **Double-Entry Equilibrium**: System reconciliation confirmed **₹0.00 discrepancy** and all 4 audit checks passed.
- **Unit Test Suite**: 5/5 tests passed in 0.15s (`test_duplicate_tick_rejection`, `test_out_of_order_sequence_rejection`, `test_out_of_order_timestamp_rejection`, `test_sequence_gap_detection`, `test_feed_handler_disconnect_and_reconnect`).
