from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from src.common.types import Side, OrderType, OrderStatus
from src.core.models import Order
from src.core.order_book import SymbolOrderBook


def test_bids_price_time_priority():
    book = SymbolOrderBook(symbol="INFY")
    t0 = datetime(2026, 1, 1, 9, 15, 0, tzinfo=timezone.utc)
    
    # Order 1: Price 100, Time t0
    o1 = Order(order_id="B1", symbol="INFY", side=Side.BUY, order_type=OrderType.LIMIT,
               quantity=10, price=Decimal("100.00"), created_at=t0, status=OrderStatus.OPEN)
    # Order 2: Price 105 (higher), Time t0 + 1s -> Should have higher priority despite later time
    o2 = Order(order_id="B2", symbol="INFY", side=Side.BUY, order_type=OrderType.LIMIT,
               quantity=10, price=Decimal("105.00"), created_at=t0 + timedelta(seconds=1), status=OrderStatus.OPEN)
    # Order 3: Price 100 (same as B1), Time t0 + 2s -> Should follow B1
    o3 = Order(order_id="B3", symbol="INFY", side=Side.BUY, order_type=OrderType.LIMIT,
               quantity=10, price=Decimal("100.00"), created_at=t0 + timedelta(seconds=2), status=OrderStatus.OPEN)

    book.add_order(o1)
    book.add_order(o2)
    book.add_order(o3)

    # Highest price first
    assert book.pop_best_bid().order_id == "B2"
    # Same price: earlier timestamp first
    assert book.pop_best_bid().order_id == "B1"
    assert book.pop_best_bid().order_id == "B3"
    assert book.pop_best_bid() is None


def test_asks_price_time_priority():
    book = SymbolOrderBook(symbol="TCS")
    t0 = datetime(2026, 1, 1, 9, 15, 0, tzinfo=timezone.utc)

    # Order 1: Ask 3000, Time t0
    o1 = Order(order_id="A1", symbol="TCS", side=Side.SELL, order_type=OrderType.LIMIT,
               quantity=10, price=Decimal("3000.00"), created_at=t0, status=OrderStatus.OPEN)
    # Order 2: Ask 2990 (cheaper), Time t0 + 1s -> Highest priority
    o2 = Order(order_id="A2", symbol="TCS", side=Side.SELL, order_type=OrderType.LIMIT,
               quantity=10, price=Decimal("2990.00"), created_at=t0 + timedelta(seconds=1), status=OrderStatus.OPEN)
    # Order 3: Ask 3000 (same price as A1), Time t0 + 2s -> Should follow A1
    o3 = Order(order_id="A3", symbol="TCS", side=Side.SELL, order_type=OrderType.LIMIT,
               quantity=10, price=Decimal("3000.00"), created_at=t0 + timedelta(seconds=2), status=OrderStatus.OPEN)

    book.add_order(o1)
    book.add_order(o2)
    book.add_order(o3)

    # Lowest price first
    assert book.pop_best_ask().order_id == "A2"
    # Same price: earlier timestamp first
    assert book.pop_best_ask().order_id == "A1"
    assert book.pop_best_ask().order_id == "A3"
    assert book.pop_best_ask() is None


def test_lazy_cancellation_pruning():
    book = SymbolOrderBook(symbol="RELIANCE")
    o1 = Order(order_id="R1", symbol="RELIANCE", side=Side.BUY, order_type=OrderType.LIMIT,
               quantity=10, price=Decimal("2500.00"), status=OrderStatus.OPEN)
    o2 = Order(order_id="R2", symbol="RELIANCE", side=Side.BUY, order_type=OrderType.LIMIT,
               quantity=15, price=Decimal("2490.00"), status=OrderStatus.OPEN)
    
    book.add_order(o1)
    book.add_order(o2)

    assert book.peek_best_bid().order_id == "R1"
    # Cancel top order
    book.cancel_order("R1")

    # Peek must prune cancelled R1 and return R2
    assert book.peek_best_bid().order_id == "R2"


def test_market_depth_aggregation():
    book = SymbolOrderBook(symbol="SBIN")
    # Multiple bids at same price level
    b1 = Order(order_id="S1", symbol="SBIN", side=Side.BUY, order_type=OrderType.LIMIT,
               quantity=50, price=Decimal("800.00"), status=OrderStatus.OPEN)
    b2 = Order(order_id="S2", symbol="SBIN", side=Side.BUY, order_type=OrderType.LIMIT,
               quantity=30, price=Decimal("800.00"), status=OrderStatus.OPEN)
    b3 = Order(order_id="S3", symbol="SBIN", side=Side.BUY, order_type=OrderType.LIMIT,
               quantity=20, price=Decimal("795.00"), status=OrderStatus.OPEN)

    book.add_order(b1)
    book.add_order(b2)
    book.add_order(b3)

    depth = book.get_market_depth(levels=5)
    bids = depth["bids"]
    assert len(bids) == 2
    assert bids[0] == {"price": Decimal("800.00"), "quantity": 80}
    assert bids[1] == {"price": Decimal("795.00"), "quantity": 20}
