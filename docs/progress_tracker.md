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
