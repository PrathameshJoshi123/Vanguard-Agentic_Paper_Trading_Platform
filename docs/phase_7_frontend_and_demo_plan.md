# Phase 7: UI Dashboard, Crash Replay & Pitch Polish — Comprehensive Architectural Plan

> **Document Status**: APPROVED & ALIGNED WITH USER PREFERENCES  
> **Target Delivery**: Complete Next.js 15 (App Router) + Tailwind CSS + TradingView Lightweight Charts Frontend Monolith Integration  
> **Alignment**: Fully adheres to [PS-05 Paper Trading Engine](file:///d:/My_Space/SYRUS_7/docs/ps.txt) and the dual-plane architecture defined in [System Architecture Plan](file:///d:/My_Space/SYRUS_7/docs/plan.txt).

---

## 1. Executive Summary & Design Vision

Phase 7 packages the complete paper trading platform into an institutional-grade, judge-proof product. Rather than a synthetic toy demo page, the system will showcase a **fully functional, production-grade institutional trading terminal and intelligence suite**.

### Core Aesthetic & Theme
- **Theme**: Sleek, minimalist **pure white theme** (`bg-white` canvas, `bg-slate-50` panels, `border-slate-200` micro-borders).
- **Navigation**: Clean **left sidebar navbar** providing fast, un-cluttered access to distinct product workspaces.
- **Top Bar**: Persistent global status bar with:
  - The **"Demo Toggle Switch"**: Live interactive switch between **LIVE NSE FEED** and **OFFLINE REPLAY**.
  - Account health: Available Cash, Utilized Margin, Realized P&L, Live MTM.
  - Feed integrity: Sequence manager health (dropped/duplicate count) and WebSocket connection indicator.
  - Server Resilience Status: Quick system recovery / event log replay trigger.

---

## 2. Technology Stack & Architectural Decisions

1. **Architecture Model**:
   - Strict **Monolith Repository**: Next.js frontend co-located in `d:/My_Space/SYRUS_7/frontend/` alongside existing `src/` backend.
   - Zero microservices: Direct integration with FastAPI backend REST endpoints and WebSocket stream.
2. **Frontend Stack**:
   - **Framework**: **Next.js 15 (App Router)** with **TypeScript** and **React 19/18**.
   - **Styling**: **Tailwind CSS** with a custom institutional light color palette.
   - **Financial Charting**: **TradingView Lightweight Charts (`lightweight-charts`)** for ultra-fast, high-framerate Candlestick OHLCV and cumulative Bid/Ask Depth charts.
   - **Icons**: `lucide-react`.
   - **Real-Time Streaming**: Native WebSocket connection hook with automatic reconnection, heartbeat ping/pong, and multi-symbol depth subscription.

---

## 3. Product Workspaces (Sidebar Navigation)

The product is organized into distinct, focused pages to eliminate clutter while keeping all information immediately accessible:

### 1. 📊 Trading Terminal (`/`)
*The active execution command center.*
- **Left Column: Market Depth & TradingView Chart**:
  - **Live 5-Depth L2 Order Book**:
    - Top 5 Bids (Price, Quantity, Orders) in emerald green with dynamic volume depth bars.
    - Top 5 Asks (Price, Quantity, Orders) in rose red with dynamic volume depth bars.
    - Real-time spread calculation and LTP badge.
  - **Interactive TradingView Price Chart**:
    - High-performance canvas chart powered by `lightweight-charts`.
    - Live OHLCV updates synced to market ticks.
- **Right Column: Instant Execution Ticket**:
  - Clean order entry form: Symbol (`RELIANCE`, `TCS`, `INFY`), Side (`BUY` / `SELL`), Product (`CNC` / `MIS`), Order Type (`MARKET`, `LIMIT`, `SL`, `SL_M`), Quantity, Price, Trigger Price.
  - **Interactive Pre-Trade Margin & Charges Preview**:
    - Automatically calculates and updates required margin, available buffer, and exact Indian regulatory charges (Brokerage, STT, Exchange turnover, SEBI fees, Stamp duty, GST) before submission.
    - Immediate visual feedback on multi-level depth fills (walking the book).

### 2. 💼 Portfolio & Positions (`/portfolio`)
*Real-time position risk and inventory management.*
- **Open Positions Tab**:
  - Live table of open positions: Symbol, Product (`CNC` vs `MIS`), Net Quantity, VWAP Buy Price, Current LTP, Realized P&L, and Live MTM P&L.
  - Action buttons: Individual position square-off.
  - **MIS Auto Square-Off Banner**: Visual timer and manual trigger for the 15:20:00 IST auto-squareoff rule.
- **Holdings Tab**:
  - Long-term delivery inventory (`CNC`), total invested capital, current market value, and total return.

### 3. 📑 Orders & Executions (`/orders`)
*Full lifecycle tracking of orders and trade legs.*
- **Open Orders Tab**:
  - Active resting orders (`OPEN`, `TRIGGER_PENDING`, `PARTIALLY_FILLED`).
  - Actions: **In-line Order Modification** (Price/Quantity) and **Order Cancellation** (with instant margin release).
- **Trade Executions Tab**:
  - Chronological execution log showing atomic match legs: Order ID, Trade ID, Maker/Taker flag, Fill Price, Filled Quantity, and Timestamp.
  - Multi-level book walk inspection (expanding an order shows every child trade leg across the depth levels).

### 4. 📒 Regulatory Ledger & Audit (`/ledger`)
*Proves complete financial traceability down to every paisa.*
- **Double-Entry T-Accounts Card**:
  - Balanced equation validator: `Total Debits == Total Credits`.
  - Zero-discrepancy audit badge (`₹0.00 Discrepancy`).
  - Breakdown across accounts: `USER_CASH`, `BROKER_REVENUE`, `STT_PAYABLE`, `EXCHANGE_FEES_PAYABLE`, `SEBI_FEES_PAYABLE`, `STAMP_DUTY_PAYABLE`, `GST_PAYABLE`.
- **Contract Note Tax Summary**:
  - Detailed breakdown of all statutory levies per settlement.
- **Customer Cash Journal**:
  - Append-only chronological entry log with running cash balance.

### 5. 🤖 Agentic AI Copilot & Risk Alerts (`/copilot`)
*The separated intelligence plane delivering research, recommendations, and autonomous monitoring.*
- **Conversational Research Assistant**:
  - Natural language chat: Researches stock fundamentals, earnings, and news.
  - Specialist routing badge: Indicates whether response was formulated by the Research, Portfolio, or Proposer agent.
  - Real citations: Displays DuckDuckGo and RSS news snippets with timestamps and source links.
- **Safety Policy Approval Gateway (Firewall)**:
  - When the agent proposes an order:
    - **Oversized / Risky Orders**: Blocked directly by the Policy Engine (e.g. value > ₹50,000 or single loss > ₹2,000) with detailed violation reasoning.
    - **Compliant Orders**: Formatted into an interactive **Approval Card** with full charges breakdown; requires explicit user approval before sending to the trading engine.
- **Proactive Risk Alert Feed**:
  - Unprompted real-time notification stream powered by the background `AutonomousEventMonitor` (e.g., tick price drops > 3% or position unrealized loss > 5%) accompanied by Mistral AI institutional risk briefs.
- **What-If Scenario Sandbox**:
  - Interactive market drop simulator: Test hypothetical percentage drops or orders to preview MTM changes and margin impact without modifying live state.

---

## 4. Supporting Backend Endpoints (FastAPI Monolith)

To complete all Phase 7 requirements, we will add the following backend routes:

1. **Market Feed & Replay API (`src/api/routers/market.py`)**:
   - `GET /api/v1/market/depth/{symbol}`: Returns current 5-depth book and LTP.
   - `GET /api/v1/market/status`: Returns current feed mode (`LIVE` vs `REPLAY`), sequence health, and tick rate.
   - `POST /api/v1/market/feed-mode`: Switches mode dynamically between `LIVE` and `REPLAY`.
2. **Crash Replay & Audit Reconciliation API (`src/api/routers/system.py`)**:
   - `POST /api/v1/system/crash-replay`: Replays all stored database events from the event store to rebuild in-memory state.
   - `GET /api/v1/system/reconcile`: Runs audit reconciliation across Orders, Trades, Positions, and Ledger cash, verifying zero discrepancies.
   - `POST /api/v1/system/simulate-drop`: Injects an instant market drop tick for a symbol to trigger the autonomous alert monitor.
3. **Agent Order Execution API (`src/api/routers/agent.py`)**:
   - `POST /api/v1/agent/execute-proposed`: Executes an approved trade payload from the copilot directly into the matching engine.

---

## 5. Phased Implementation Roadmap

- **Phase 7A: Backend API Support & Crash Recovery**:
  - Implement `market.py` and `system.py` routers with crash replay and reconciliation logic.
  - Add unit/integration tests to ensure all 68+ tests pass and crash recovery maintains 0.00 discrepancy.
- **Phase 7B: Next.js 15 Monolith Scaffold & Theme Setup**:
  - Scaffold Next.js in `frontend/` with App Router, TypeScript, Tailwind CSS, and Lucide icons.
  - Build sleek white theme shell, sidebar navbar, and global header with "Demo Toggle Switch".
  - Build persistent WebSocket client hook with automated channel subscription and state synchronization.
- **Phase 7C: Trading Terminal with TradingView Lightweight Charts & Depth Book**:
  - Implement canvas candlestick chart with live tick streaming.
  - Implement 5-depth L2 order book with bid/ask volume bars.
  - Implement instant order ticket with live margin and Indian tax/charges preview.
- **Phase 7D: Portfolio, Orders & Double-Entry Ledger Views**:
  - Implement open positions table with real-time MTM updates and MIS square-off control.
  - Implement open orders, modification/cancellation controls, and trade execution leg inspector.
  - Implement double-entry T-accounts view with discrepancy auditor and contract note tax breakdown.
- **Phase 7E: Agentic Copilot, Policy Gate & Proactive Alert Feed**:
  - Implement chat copilot interface with live market research citations.
  - Implement Policy Gateway interactive approval modal/card for agent-proposed orders.
  - Implement live proactive alert stream and What-If scenario sandbox.
- **Phase 7F: Full End-to-End Testing & Polish**:
  - Verify seamless communication between Next.js frontend and FastAPI backend.
  - Test deterministic 500-share market order book walk, crash recovery reload, policy gate enforcement, and proactive drop alert.
