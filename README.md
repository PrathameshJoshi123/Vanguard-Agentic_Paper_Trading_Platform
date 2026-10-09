# SYRUS 7 — Paper Trading Engine (021-02)

> **"The Ledger Never Lies"**: A high-performance, deterministic paper trading engine that executes simulated orders against live 021 market data with realistic depth fills, stop-loss management, statutory Indian regulatory accounting, and zero-discrepancy double-entry ledgers down to the exact paisa.

---

## 1. Compliance with Hackathon Problem Statement 021-02

In strict adherence to the rules of **021-02: Paper Trading Engine**:
1. **Zero External Orders**: Orders placed by users or the automated test harness stay completely inside this application. **No order APIs are ever called on the 021 broker**.
2. **Engine Ownership**: This engine owns the entire order lifecycle: in-memory price-time priority heap books, trade executions, position tracking, cash ledger, and risk controls.
3. **021 Market Data Ingestion**: Consumes live market data using 021's permitted endpoints (`POST /auth/token`, `GET /instruments`, `GET /websocket/ephemeral-key`, and the binary market WebSocket).
4. **Test Harness API Contract**: Implements the official 021 REST API contract (`/api/developer-api/v1/...`) with integer paise precision and signed quantities so the judges' test harness drives the engine seamlessly.

---

## 2. Three Levels of Implementation

### Level 1 (L1): Delivery (CNC) on NSE Equities
- **Order Types**: Market and Limit orders for delivery (`product: "CNC"`).
- **Order Lifecycle**: Sub-millisecond order placement, modification, and cancellation via priority heap order books (`src/core/`).
- **Portfolio & Accounting**: Real-time Volume Weighted Average Price (VWAP), realized and unrealized P&L, and delivery holdings inventory (`src/portfolio/`).
- **Immutable Double-Entry Ledger**: Dual-layer customer cash journal with running balance and balanced T-accounts (`src/ledger/journal.py`).
- **Continuous Audit Reconciliation**: Continuous auditor guaranteeing $\Sigma\text{Debits} == \Sigma\text{Credits}$ with $\text{₹}0.00$ discrepancy (`src/core/reconciliation.py`).

### Level 2 (L2): Realistic Market Depth Fills & Stop-Loss
- **Stop-Loss Orders**: Stop-Loss Limit (`SL`) and Stop-Loss Market (`SL-M`) orders managed by [`MarketDepthMatcher`](src/market_data/depth_matcher.py). Orders rest in `TRIGGER_PENDING` until LTP crosses the trigger price.
- **Realistic Depth Fills & Book Walks**: Simulated market orders do not fill naively at the top of book. If an order requires 5,000 shares and only 200 are resting at Level 1, the engine walks through available depth levels, computing exact execution VWAP with slippage and leaving partial fills open for resting limits.

### Level 3 (L3): Intraday (MIS) & Regulatory Charges
- **Intraday Leverage & Margins**: Upfront margin requirements with 5x leverage (20% margin for MIS) and 100% margin for CNC (`src/risk/margin.py`). Orders are rejected with detailed rationale when margin is short.
- **Deterministic 15:20 IST Auto Square-off**: Background scheduler (`src/scheduler/service.py`) and settlement worker (`src/settlement/mis_squareoff.py`) scanning all open MIS positions and injecting market square-off orders at 15:20:00 IST.
- **Indian Regulatory Charges**: Deterministic contract note calculations (`src/ledger/charges.py`) itemizing Brokerage, Securities Transaction Tax (STT), Exchange turnover charges, SEBI turnover fees, Stamp duty, and 18% GST down to the exact paisa.

---

## 3. 021 Live Market Feed Ingestion Architecture

```
[021 Sandbox] ---> REST Auth & Ephemeral Key ---> [Zero21Client]
[021 Sandbox] ---> GET /instruments (CSV.gz) ---> [InstrumentMaster] (O(1) Token Map)
[021 Sandbox] ---> wss://.../websocket/market  ---> [Zero21MarketFeedHandler]
                                                           |
                                                [BinaryPacketParser]
                                                (TC 1 LTP, TC 3 220B NSECM)
                                                           |
                                                [SequenceManager]
                                                (Dedup, Order, Gap Check)
                                                           |
                                                [MarketDepthMatcher]
                                                           |
                                             [DeterministicMatchingEngine]
```

1. **Authentication & Session Management (`src/market_data/zero21/client.py`)**:
   - Strictly enforces the single-live-token rule. Persists active tokens across reboots in `data/zero21_token.json` to prevent session revocations.
   - Automatically handles daily token expiration and transparent 401 re-authentication on ephemeral key requests.
2. **Sub-Microsecond Instrument Master (`src/market_data/zero21/instruments.py`)**:
   - Downloads and decompresses gzipped CSV (~105,000 contracts), caches to `data/instruments.csv`.
   - In-memory $O(1)$ lookups: `token -> symbol`, `symbol -> token`, tick size, and circuit limits.
   - Preloaded with liquid seed contracts (`RELIANCE` 2885, `TCS` 11536, `INFY` 1594, `HDFCBANK` 1333) for zero-crash offline boot.
3. **Zero-Allocation Binary Parser (`src/market_data/zero21/parser.py`)**:
   - Decodes Big-Endian byte frames in native C speed:
     - **TC 1 (LTP, 12 Bytes)** + optional 5-byte snapshot open/close frames.
     - **TC 3 (NSECM Full Depth, 220 Bytes)** unpacking all 10 order book levels (5 bids + 5 asks with quantity, price, and orders count), OHLC, volume, and trade times.
     - **TC 10 (Heartbeat, 2 Bytes)** auto-skipped.
4. **Feed Resilience (`src/market_data/sequence_manager.py`)**:
   - Discards duplicate ticks, drops out-of-order packets, detects sequence gaps, and monitors feed health.
   - Recovers from daily 08:00 IST exchange disconnects with exponential backoff and auto-resubscription.

---

## 4. Official Test Harness REST API Contract

Mounted at both `/api/developer-api/v1` and `/developer-api/v1`:

| Endpoint | Method | Description | Units / Schema |
| :--- | :--- | :--- | :--- |
| `/auth/token` | `POST` | Authenticate with test harness | Envelope with `accessToken` |
| `/websocket/ephemeral-key` | `GET` | Ephemeral WebSocket token | Envelope with `token` |
| `/instruments` | `GET` | Master instrument contracts | CSV stream (`--compressed`) |
| `/orders` | `POST` | Place simulated order | `token`, `qty` (+ buy, - sell), `price` (paise), `book` (RL/SL) |
| `/orders/{orderId}` | `PUT` | Modify resting order | Full new state in paise |
| `/orders/{orderId}` | `DELETE`| Cancel resting order | Instant margin unblocking |
| `/orders` | `GET` | List today's orders | Plain JSON array (newest first) |
| `/orders/{orderId}` | `GET` | Get single order | 1-element JSON array |
| `/trades` | `GET` | List today's executed trades | Plain JSON array with fill prices in paise |
| `/orders/{orderId}/trades`| `GET` | Trades for specific order | Plain JSON array |
| `/portfolio/positions` | `GET` | Open & closed positions | `netQuantity`, `netPrice` (paise), `squareOffQuantity` |
| `/portfolio/holdings` | `GET` | CNC delivery holdings | `isin`, `symbol`, `freeQty`, average price in paise |

---

## 5. Quick Start & Setup

### Environment Configuration (`.env`)
Copy `.env.example` to `.env` and configure your credentials:
```bash
# 021 Trade Developer Sandbox Credentials
ZERO21_UCC=HACK1234
ZERO21_PASSWORD=your_password_here
# Optional: Pre-generated Access Token
ZERO21_ACCESS_TOKEN=
ZERO21_BASE_URL=https://devapi.021.trade/api/developer-api/v1
ZERO21_WS_BASE_URL=wss://devapi.021.trade/api/developer/websocket/market
```

### Launching the Backend Server
```powershell
.\.venv\Scripts\Activate.ps1
python run_server.py
```
*API server runs at `http://localhost:8000` with interactive OpenAPI docs at `http://localhost:8000/docs`.*

### Launching the Frontend Terminal (Optional UI)
```powershell
cd frontend
npm run dev
```
*Trading terminal available at `http://localhost:3000`.*

---

## 6. Verification Suite

All modules are backed by automated tests:
```powershell
python -m pytest tests/
```
- `tests/unit/test_zero21_client.py`: 021 Auth, single-token reuse, disk persistence, and 401 recovery.
- `tests/unit/test_zero21_instruments.py`: Token/symbol indexing, CSV parsing, and gzip decompression.
- `tests/unit/test_zero21_binary_parser.py`: TC 1, TC 3 220B NSECM depth, TC 10 heartbeat, and multi-packet framing.
- `tests/unit/test_zero21_feed_handler.py`: WebSocket subscriptions, binary tick dispatch, and deduplication.
- `tests/integration/test_zero21_api_contract.py`: Complete test harness lifecycle (auth, orders, fills, positions, margin rejection).
