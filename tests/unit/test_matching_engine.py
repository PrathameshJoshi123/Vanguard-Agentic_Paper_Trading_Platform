from decimal import Decimal
import pytest

from src.common.types import Side, OrderType, OrderStatus
from src.core.models import Order
from src.core.matching_engine import DeterministicMatchingEngine


def test_phase_1_exit_criteria():
    """Phase 1 Exit Criteria / Unit Test:
    
    1. Place a Buy Limit order for 100 shares @ ₹2,500.
    2. Place a Sell Limit order for 40 shares @ ₹2,500.
    3. Verify order 1 has 60 remaining (PARTIALLY_FILLED).
    4. Verify order 2 is FILLED.
    5. Verify exactly 1 match occurred with correct price and quantity.
    """
    engine = DeterministicMatchingEngine()

    # Step 1: Place Buy Limit order for 100 shares @ ₹2,500
    order_1 = Order(
        order_id="ORD-BUY-001",
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        quantity=100,
        price=Decimal("2500.00"),
    )
    result_1 = engine.place_order(order_1)

    # Order 1 rests on the book
    assert len(result_1.matches) == 0
    assert order_1.status == OrderStatus.OPEN
    assert order_1.remaining_qty == 100
    assert order_1.filled_qty == 0

    # Step 2: Place Sell Limit order for 40 shares @ ₹2,500
    order_2 = Order(
        order_id="ORD-SELL-002",
        symbol="RELIANCE",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        quantity=40,
        price=Decimal("2500.00"),
    )
    result_2 = engine.place_order(order_2)

    # Step 3 & 4: Verify Order 1 and Order 2 states & quantities
    assert order_1.status == OrderStatus.PARTIALLY_FILLED
    assert order_1.remaining_qty == 60
    assert order_1.filled_qty == 40
    assert order_1.average_fill_price == Decimal("2500.00")

    assert order_2.status == OrderStatus.FILLED
    assert order_2.remaining_qty == 0
    assert order_2.filled_qty == 40
    assert order_2.average_fill_price == Decimal("2500.00")

    # Step 5: Verify atomic match and trade events
    assert len(result_2.matches) == 1
    match = result_2.matches[0]
    assert match.price == Decimal("2500.00")
    assert match.quantity == 40
    assert match.maker_order_id == "ORD-BUY-001"
    assert match.taker_order_id == "ORD-SELL-002"

    # Leg trade events (Option B: individual leg events for maker and taker)
    assert len(result_2.trade_events) == 2
    maker_evt = next(e for e in result_2.trade_events if e.order_id == "ORD-BUY-001")
    taker_evt = next(e for e in result_2.trade_events if e.order_id == "ORD-SELL-002")

    assert maker_evt.is_maker is True
    assert maker_evt.price == Decimal("2500.00")
    assert maker_evt.quantity == 40
    assert maker_evt.counterparty_order_id == "ORD-SELL-002"

    assert taker_evt.is_maker is False
    assert taker_evt.price == Decimal("2500.00")
    assert taker_evt.quantity == 40
    assert taker_evt.counterparty_order_id == "ORD-BUY-001"

    # Verify order book state: Order 1 remains at top of bid book with 60 shares
    book = engine.get_or_create_book("RELIANCE")
    top_bid = book.peek_best_bid()
    assert top_bid is not None
    assert top_bid.order_id == "ORD-BUY-001"
    assert top_bid.remaining_qty == 60


def test_multi_level_partial_fill_walk():
    """Incoming order walks across multiple book levels."""
    engine = DeterministicMatchingEngine()

    # Place two resting asks:
    # 50 shares @ 100
    # 50 shares @ 102
    ask1 = Order(order_id="ASK-1", symbol="INFY", side=Side.SELL, order_type=OrderType.LIMIT,
                 quantity=50, price=Decimal("100.00"))
    ask2 = Order(order_id="ASK-2", symbol="INFY", side=Side.SELL, order_type=OrderType.LIMIT,
                 quantity=50, price=Decimal("102.00"))
    engine.place_order(ask1)
    engine.place_order(ask2)

    # Incoming Buy Limit for 80 shares @ 102
    buy = Order(order_id="BUY-1", symbol="INFY", side=Side.BUY, order_type=OrderType.LIMIT,
                quantity=80, price=Decimal("102.00"))
    res = engine.place_order(buy)

    # Should match 50 @ 100 and 30 @ 102
    assert len(res.matches) == 2
    assert res.matches[0].quantity == 50
    assert res.matches[0].price == Decimal("100.00")
    assert res.matches[1].quantity == 30
    assert res.matches[1].price == Decimal("102.00")

    assert buy.status == OrderStatus.FILLED
    assert buy.remaining_qty == 0
    assert buy.filled_qty == 80
    # VWAP = ((50*100) + (30*102)) / 80 = (5000 + 3060) / 80 = 8060 / 80 = 100.75
    assert buy.average_fill_price == Decimal("100.75")

    # Ask 1 is FILLED, Ask 2 has 20 remaining
    assert ask1.status == OrderStatus.FILLED
    assert ask2.status == OrderStatus.PARTIALLY_FILLED
    assert ask2.remaining_qty == 20


def test_market_order_ioc_depth_exhaustion():
    """Option A: Market order fills available depth and cancels unfilled remainder."""
    engine = DeterministicMatchingEngine()

    # Book has only 30 shares @ 500
    ask = Order(order_id="ASK-1", symbol="TCS", side=Side.SELL, order_type=OrderType.LIMIT,
                quantity=30, price=Decimal("500.00"))
    engine.place_order(ask)

    # Market order arrives wanting 100 shares
    mkt_buy = Order(order_id="MKT-BUY", symbol="TCS", side=Side.BUY, order_type=OrderType.MARKET,
                    quantity=100)
    res = engine.place_order(mkt_buy)

    assert len(res.matches) == 1
    assert res.matches[0].quantity == 30
    assert res.matches[0].price == Decimal("500.00")

    # Remainder was cancelled (Option A)
    assert mkt_buy.status == OrderStatus.CANCELLED
    assert mkt_buy.filled_qty == 30
    assert mkt_buy.remaining_qty == 0


def test_passive_maker_price_priority():
    """Execution price is determined by the resting Maker order, not the aggressive taker."""
    engine = DeterministicMatchingEngine()

    # Resting sell @ 200
    ask = Order(order_id="ASK-1", symbol="HDFC", side=Side.SELL, order_type=OrderType.LIMIT,
                quantity=10, price=Decimal("200.00"))
    engine.place_order(ask)

    # Aggressive buy willing to pay up to 210
    buy = Order(order_id="BUY-1", symbol="HDFC", side=Side.BUY, order_type=OrderType.LIMIT,
                quantity=10, price=Decimal("210.00"))
    res = engine.place_order(buy)

    # Must execute at 200.00 (maker's price)
    assert res.matches[0].price == Decimal("200.00")


def test_non_crossing_orders_rest_on_book():
    """Limit orders that do not cross rest on their respective sides of the book."""
    engine = DeterministicMatchingEngine()

    buy = Order(order_id="BUY-1", symbol="INFY", side=Side.BUY, order_type=OrderType.LIMIT,
                quantity=10, price=Decimal("1500.00"))
    sell = Order(order_id="SELL-1", symbol="INFY", side=Side.SELL, order_type=OrderType.LIMIT,
                 quantity=10, price=Decimal("1510.00"))

    res_buy = engine.place_order(buy)
    res_sell = engine.place_order(sell)

    assert len(res_buy.matches) == 0
    assert len(res_sell.matches) == 0
    assert buy.status == OrderStatus.OPEN
    assert sell.status == OrderStatus.OPEN

    book = engine.get_or_create_book("INFY")
    assert book.best_bid_price == Decimal("1500.00")
    assert book.best_ask_price == Decimal("1510.00")
    assert book.spread == Decimal("10.00")


def test_order_cancellation_via_engine():
    """Resting orders can be cancelled through the engine interface."""
    engine = DeterministicMatchingEngine()

    order = Order(order_id="ORD-CANCEL-ME", symbol="WIPRO", side=Side.BUY, order_type=OrderType.LIMIT,
                  quantity=50, price=Decimal("450.00"))
    engine.place_order(order)
    assert order.status == OrderStatus.OPEN

    cancelled = engine.cancel_order("WIPRO", "ORD-CANCEL-ME")
    assert cancelled.status == OrderStatus.CANCELLED
    assert cancelled.remaining_qty == 0

    book = engine.get_or_create_book("WIPRO")
    assert book.peek_best_bid() is None


def test_successive_partial_fills_until_maker_completion():
    """A large resting order gets filled in multiple pieces by successive smaller incoming orders."""
    engine = DeterministicMatchingEngine()

    # Large maker: 100 shares @ 1000
    maker = Order(order_id="MAKER-1", symbol="SBIN", side=Side.BUY, order_type=OrderType.LIMIT,
                  quantity=100, price=Decimal("1000.00"))
    engine.place_order(maker)

    # First incoming taker: 30 shares
    taker1 = Order(order_id="TAKER-1", symbol="SBIN", side=Side.SELL, order_type=OrderType.LIMIT,
                   quantity=30, price=Decimal("1000.00"))
    res1 = engine.place_order(taker1)
    assert maker.status == OrderStatus.PARTIALLY_FILLED
    assert maker.remaining_qty == 70
    assert maker.filled_qty == 30
    assert taker1.status == OrderStatus.FILLED

    # Second incoming taker: 50 shares
    taker2 = Order(order_id="TAKER-2", symbol="SBIN", side=Side.SELL, order_type=OrderType.LIMIT,
                   quantity=50, price=Decimal("1000.00"))
    res2 = engine.place_order(taker2)
    assert maker.status == OrderStatus.PARTIALLY_FILLED
    assert maker.remaining_qty == 20
    assert maker.filled_qty == 80
    assert taker2.status == OrderStatus.FILLED

    # Third incoming taker: 20 shares (finishes the maker)
    taker3 = Order(order_id="TAKER-3", symbol="SBIN", side=Side.SELL, order_type=OrderType.LIMIT,
                   quantity=20, price=Decimal("1000.00"))
    res3 = engine.place_order(taker3)
    assert maker.status == OrderStatus.FILLED
    assert maker.remaining_qty == 0
    assert maker.filled_qty == 100
    assert taker3.status == OrderStatus.FILLED

    # Order book is now empty
    book = engine.get_or_create_book("SBIN")
    assert book.peek_best_bid() is None

