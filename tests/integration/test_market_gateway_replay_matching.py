import os
from decimal import Decimal
import pytest

from src.common.types import Side, OrderType, OrderStatus, ProductType
from src.core.models import Order
from src.core.trade_service import TradeExecutionService
from src.market_data.depth_matcher import MarketDepthMatcher
from src.market_data.gateway import MarketDataGateway


@pytest.mark.asyncio
async def test_replay_50_ticks_reliance_fills_resting_limit_orders():
    """
    Phase 3 Exit Criteria / Verification Test:
      1. Flip config to REPLAY_MODE = True.
      2. Feed 50 historical ticks of RELIANCE from .jsonl.
      3. Verify that resting Limit orders placed in the book are automatically crossed
         and filled by incoming market depth at realistic prices.
      4. Verify that financial accounting, ledger running balance, and positions reflect the fills.
    """
    trade_service = TradeExecutionService()
    account_id = "ACC_REPLAY_TEST"
    initial_cash = Decimal("500000.00")
    trade_service.register_account(account_id, initial_deposit=initial_cash)

    depth_matcher = MarketDepthMatcher(trade_service)

    # 1. Place a resting BUY Limit order: Buy 100 RELIANCE @ 2490.00 MIS
    # The starting price in the tick feed is 2500.00. The market will drop to ~2487.50,
    # so this resting buy limit order should get filled when market depth asks cross 2490.00.
    buy_order = Order(
        order_id="REST-BUY-001",
        account_id=account_id,
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        price=Decimal("2490.00"),
        quantity=100,
        product_type=ProductType.MIS,
        status=OrderStatus.PENDING,
    )
    # Put it on the book
    trade_service.place_order(buy_order)
    assert buy_order.status == OrderStatus.OPEN
    assert buy_order.remaining_qty == 100

    # 2. Place a resting SELL Limit order: Sell 50 RELIANCE @ 2503.00 MIS
    # When the market bounces up in later ticks past 2503.00 (max bid reaches 2503.80), this should also cross and fill!
    sell_order = Order(
        order_id="REST-SELL-002",
        account_id=account_id,
        symbol="RELIANCE",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        price=Decimal("2503.00"),
        quantity=50,
        product_type=ProductType.MIS,
        status=OrderStatus.PENDING,
    )

    trade_service.place_order(sell_order)
    assert sell_order.status == OrderStatus.OPEN

    # 3. Configure and launch MarketDataGateway in REPLAY_MODE
    tick_file_path = os.path.abspath("data/reliance_50_ticks.jsonl")
    gateway = MarketDataGateway(
        replay_mode=True,
        replay_file_path=tick_file_path,
        replay_speed_multiplier=0,  # fast-forward / zero delay for deterministic test
        depth_matcher=depth_matcher,
    )

    # 4. Stream and process the 50 ticks
    ticks_processed = await gateway.run_replay()
    assert ticks_processed == 50

    # 5. Verify the resting orders were filled!
    # BUY order was crossed when ask touched <= 2490.00
    assert buy_order.status == OrderStatus.FILLED
    assert buy_order.remaining_qty == 0
    assert buy_order.filled_qty == 100
    assert buy_order.average_fill_price == Decimal("2490.00")

    # SELL order was crossed when bid touched >= 2503.00
    assert sell_order.status == OrderStatus.FILLED
    assert sell_order.remaining_qty == 0
    assert sell_order.filled_qty == 50
    assert sell_order.average_fill_price == Decimal("2503.00")


    # 6. Verify ledger & position updates
    pos = trade_service.position_manager.get_position(account_id, "RELIANCE", ProductType.MIS)
    assert pos is not None
    # Bought 100, Sold 50 -> Net open position is Long 50
    assert pos.quantity == 50
    assert pos.realized_pnl > Decimal("0.00")  # Profited on the 50 sold @ 2504 vs bought @ 2490

    # Feed health stats
    health = gateway.get_feed_health("RELIANCE")
    assert health.total_ticks_processed == 50
    assert health.duplicate_ticks_dropped == 0
    assert health.out_of_order_ticks_dropped == 0
