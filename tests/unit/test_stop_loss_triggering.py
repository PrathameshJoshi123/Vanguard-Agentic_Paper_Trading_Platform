from decimal import Decimal
import pytest

from src.common.types import Side, OrderType, OrderStatus, ProductType
from src.core.models import Order
from src.core.trade_service import TradeExecutionService
from src.market_data.depth_matcher import MarketDepthMatcher
from src.market_data.models import DepthLevel, MarketDepth


def test_sl_and_sl_m_trigger_pipeline():
    trade_service = TradeExecutionService()
    account_id = "ACC_SL_TEST"
    trade_service.register_account(account_id, initial_deposit=Decimal("100000.00"))

    depth_matcher = MarketDepthMatcher(trade_service)

    # 1. Register a BUY Stop-Loss Limit (SL) order: Trigger @ 2510.00, Limit @ 2512.00
    sl_order = Order(
        order_id="SL-001",
        account_id=account_id,
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.SL,
        quantity=50,
        price=Decimal("2512.00"),
        trigger_price=Decimal("2510.00"),
        product_type=ProductType.MIS,
        status=OrderStatus.PENDING,
    )
    depth_matcher.register_trigger_order(sl_order)
    assert sl_order.status == OrderStatus.TRIGGER_PENDING

    # 2. Register a SELL Stop-Loss Market (SL-M) order: Trigger @ 2490.00
    slm_order = Order(
        order_id="SLM-002",
        account_id=account_id,
        symbol="RELIANCE",
        side=Side.SELL,
        order_type=OrderType.SL_M,
        quantity=30,
        trigger_price=Decimal("2490.00"),
        product_type=ProductType.MIS,
        status=OrderStatus.PENDING,
    )
    depth_matcher.register_trigger_order(slm_order)
    assert slm_order.status == OrderStatus.TRIGGER_PENDING

    # Tick 1: Market LTP = 2505.00 (Neither triggered)
    depth_1 = MarketDepth(
        symbol="RELIANCE",
        ltp=Decimal("2505.00"),
        bids=[DepthLevel(price=Decimal("2504.50"), quantity=100)],
        asks=[DepthLevel(price=Decimal("2505.50"), quantity=100)],
        sequence_id=1,
    )
    res_1 = depth_matcher.on_market_depth(depth_1)
    assert len(res_1) == 0
    assert sl_order.status == OrderStatus.TRIGGER_PENDING
    assert slm_order.status == OrderStatus.TRIGGER_PENDING

    # Tick 2: Market spikes up to LTP = 2510.50 (SL-001 triggered and then filled because ask 2511.00 <= limit 2512.00!)
    depth_2 = MarketDepth(
        symbol="RELIANCE",
        ltp=Decimal("2510.50"),
        bids=[DepthLevel(price=Decimal("2510.00"), quantity=100)],
        asks=[DepthLevel(price=Decimal("2511.00"), quantity=100)],
        sequence_id=2,
    )
    res_2 = depth_matcher.on_market_depth(depth_2)
    # res_2 contains the SL trigger event AND the subsequent resting limit order fill against ask depth
    assert len(res_2) == 2
    assert res_2[0].order.order_id == "SL-001"
    assert "SL order triggered" in res_2[0].trigger_message
    assert sl_order.status == OrderStatus.FILLED


    # Tick 3: Market drops down to LTP = 2489.00 (SLM-002 triggered!)
    depth_3 = MarketDepth(
        symbol="RELIANCE",
        ltp=Decimal("2489.00"),
        bids=[DepthLevel(price=Decimal("2488.50"), quantity=100)],
        asks=[DepthLevel(price=Decimal("2489.50"), quantity=100)],
        sequence_id=3,
    )
    res_3 = depth_matcher.on_market_depth(depth_3)
    assert len(res_3) >= 1
    assert slm_order.order_type == OrderType.MARKET
    assert "SL-M order triggered" in res_3[0].trigger_message
