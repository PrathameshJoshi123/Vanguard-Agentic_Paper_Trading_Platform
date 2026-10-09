These are the three most fundamental questions in understanding how a real trading engine works versus how a toy simulator works. Let’s break down each one with 100% clarity.

---

# 1. Exactly What Data Do We Get From 021 APIs?

Under the hackathon rules for **021-02 (Paper Trading)**, we are **only allowed to consume market data** from 021. We **never** send our users' orders to their servers. 

Here is the exact data we pull from 021:

### A. The Master Instruments File (`GET /instruments`)
We download this once at startup (gzipped CSV). It gives us the reference dictionary for all ~105,000 stocks and contracts:
* `token`: The internal ID (e.g. `2885` for RELIANCE).
* `symbol`: The ticker (e.g. `RELIANCE`, `TCS`, `INFY`).
* `exchange`: Exchange segment (`NSECM` for NSE Equity, `NSEFO` for F&O, etc.).
* `ticksize`: Minimum price movement in paise (e.g. `5` paise = ₹0.05).
* `lower_circuit` & `upper_circuit`: The price boundaries allowed today in paise.
* `freeze_quantity`: Max shares allowed in a single order (e.g. 984,600).
* `board_lot_quantity`: Lot size (1 for stocks, 25/50/etc. for options/futures).

---

### B. Live WebSocket Feed (`wss://devapi.021.trade/.../market`)
Once connected, 021 streams **binary packets** (big-endian byte buffers) of two primary transaction codes (TCs):

#### 1. TC 1: LTP Packet (12 bytes)
Sent on every price tick:
* `TC` (2 bytes) = 1
* `Exchange Code` (2 bytes) = 1 (NSE Cash)
* `Token` (4 bytes) = e.g., 2885
* `LTP` (4 bytes) = Last Traded Price in **paise** (e.g. `250430` = ₹2,504.30)

#### 2. TC 3: Full Market Depth Packet (220 bytes for NSECM)
This is the golden data packet that powers our L2 matching. It contains:
* **OHLCV**: Open, High, Low, Close, Last Traded Volume, Total Day Volume.
* **Exchange Timestamps**: For replay & sequencing.
* **Top 5 Bids (Buyers) & Top 5 Asks (Sellers)**:
  For each of the 5 price levels, it gives:
  * **Price** (in paise)
  * **Quantity** (total shares available at that price)
  * **Number of Orders** (how many people are queued at that level)

```
  Example 5-Level Depth received from 021 for RELIANCE:
  
        BIDS (Buyers waiting)             ASKS (Sellers waiting)
  Level | Qty   | Orders | Price(₹)   Level | Price(₹) | Orders | Qty
  ──────┼───────┼────────┼────────    ──────┼──────────┼────────┼──────
    1   |   345 |    4   | 2,503.80     1   | 2,504.80 |    5   |  395
    2   |   445 |    8   | 2,503.30     2   | 2,505.30 |   10   |  495
    3   |   300 |    3   | 2,502.80     3   | 2,505.80 |    4   |  350
    4   |   600 |    9   | 2,502.30     4   | 2,506.30 |    7   |  800
    5   | 1,200 |   15   | 2,501.80     5   | 2,506.80 |   12   | 1,500
```
> **What We DO NOT Get from 021:** 
> 021 does **not** manage our orders, our account balance, or our trades. All order matching, accounting, and positions are simulated locally inside our engine using this market depth.

---

# 2. What Happens If Someone Places a Buy Order Before Another Places a Sell Order?

This is the foundation of an **Order Book** (Price-Time Priority, or FIFO).

### Scenario A: A Limit Order (Waiting in the Book)
Suppose RELIANCE's current market price is ₹2,504.80.
* **User A places a Limit BUY**: 10 shares @ **₹2,500.00**.
* **What happens immediately?**
  1. No seller in the market is willing to sell at ₹2,500.00 right now (the cheapest seller is at ₹2,504.80).
  2. The engine **does not fill the order**.
  3. Instead, the engine puts User A's order into the **Order Book's Bid Queue** with status `Placed`.
  4. The engine **locks ₹25,000** of User A's cash as margin.
* **Later, User B places a Sell Order**: 10 shares @ ₹2,500.00 (or market price falls to ₹2,500.00):
  1. The engine checks the resting Buy Book.
  2. It finds User A was first in line at ₹2,500.00.
  3. It executes the trade: User A gets the 10 shares, User B gets the cash, and User A's locked margin is converted to actual purchase cost.

### Scenario B: A Market Order (Immediate Fill Against Live Depth)
* If User A places a **Market BUY** for 10 shares:
  * User A doesn't wait for another paper user to place a sell order!
  * Why? Because our engine matches User A against the **live 021 market asks** (Level 1 Ask: ₹2,504.80 has 395 shares).
  * User A instantly gets filled 10 shares @ ₹2,504.80 from the simulated market depth!

---

# 3. How Can Someone Place a Sell Order Without Having Bought First?

In real stock exchanges and in our engine, selling without first owning shares is called **Short Selling**. Here is how it works and what the rules are:

### Rule 1: In Delivery Mode (`CNC` - Cash and Carry)
* **You CANNOT sell without owning the shares.**
* When a user submits a Sell order with `product: "CNC"`:
  * Our `RiskEngine` looks up their `Portfolio Holdings`.
  * If the user owns 0 shares of RELIANCE, the order is **IMMEDIATELY REJECTED**:
    > *"Insufficient holdings: Cannot place CNC sell order without settled delivery shares."*

---

### Rule 2: In Intraday Mode (`MIS` - Margin Intraday Square-off)
* **You CAN sell without owning the shares! This is legal and standard in stock markets.**
* **Why is it allowed?**
  * In intraday trading, you do not deliver actual stock certificates to a demat account. You are only betting on price direction within the same trading day.
  * If you believe a stock will drop, you **Sell first** (go *Short*), and you must **Buy back later** (cover the short) before the market closes.

#### How It Works Step-by-Step:
1. **At 10:00 AM (Selling Short)**:
   * Stock is at ₹2,500.
   * User places a Sell MIS order for 10 shares (`qty: -10`).
   * The user owns 0 shares. The engine checks: *Does the user have margin to absorb potential losses?*
   * Margin required: $10 \times ₹2,500 \times 20\% = ₹5,000$. The engine blocks ₹5,000.
   * Order fills! The user's position in `GET /portfolio/positions` is now:
     * `netQuantity: -10` (Short position)
     * `sellPrice: 250000` paise (₹2,500.00)

2. **At 02:00 PM (Closing the Position)**:
   * **Case 1 (Profit)**: Stock falls to ₹2,400.
     * The user buys 10 shares (`qty: +10`) to square off.
     * Profit = Sold at ₹2,500 − Bought at ₹2,400 = **+₹1,000**.
     * Net quantity becomes `0`. Margin is unlocked, and ₹1,000 profit is credited to their cash balance.
   * **Case 2 (Loss)**: Stock rises to ₹2,600.
     * The user buys 10 shares to close.
     * Loss = Sold at ₹2,500 − Bought at ₹2,600 = **-₹1,000**.
     * ₹1,000 is deducted from their cash balance.

3. **What if the user forgets to buy it back?**
   * **The 15:20 IST Rule kicks in!**
   * Our `src/settlement/mis_squareoff.py` automatically sweeps all open positions with `netQuantity != 0` at 15:20 IST.
   * It forcibly sends an opposite Buy order (`qty: +10`) at the current market price, closing the short so that no overnight short delivery penalty occurs.

---

### Summary Checklist

| Concept | How Our Engine Handles It |
| :--- | :--- |
| **021 Data** | Master instruments CSV + Real-time binary WebSocket (LTP & 5-level Bids/Asks depth). |
| **Buy Before Sell** | Buy orders wait in the heap-based order book if their price is lower than market asks, or fill instantly against market depth if marketable. |
| **Selling Without Buying (CNC)** | **Blocked & Rejected** by our pre-trade Risk Engine. |
| **Selling Without Buying (MIS)** | **Permitted as Short Selling**, backed by 20% margin, and auto-squared off at 15:20 IST. |

