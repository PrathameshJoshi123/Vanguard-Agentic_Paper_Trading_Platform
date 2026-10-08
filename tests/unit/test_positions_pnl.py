from decimal import Decimal
import pytest

from src.common.types import Side, ProductType
from src.core.models import TradeEvent
from src.portfolio.position_manager import PositionManager


def test_position_vwap_and_realized_pnl():
    pm = PositionManager()
    account_id = "ACC_1"

    # 1. Buy 50 @ ₹100
    t1 = TradeEvent(
        trade_id="TR_1",
        order_id="ORD_1",
        symbol="TCS",
        side=Side.BUY,
        price=Decimal("100.00"),
        quantity=50,
        counterparty_order_id="CP_1",
        is_maker=False,
    )
    pos, pnl = pm.apply_trade(account_id, ProductType.MIS, t1)
    assert pos.quantity == 50
    assert pos.average_price == Decimal("100.00")
    assert pnl == Decimal("0.00")

    # 2. Buy another 50 @ ₹110 -> VWAP = ((50*100) + (50*110)) / 100 = ₹105.00
    t2 = TradeEvent(
        trade_id="TR_2",
        order_id="ORD_2",
        symbol="TCS",
        side=Side.BUY,
        price=Decimal("110.00"),
        quantity=50,
        counterparty_order_id="CP_2",
        is_maker=False,
    )
    pos, pnl = pm.apply_trade(account_id, ProductType.MIS, t2)
    assert pos.quantity == 100
    assert pos.average_price == Decimal("105.00")
    assert pnl == Decimal("0.00")

    # 3. Sell 40 @ ₹120 -> Realized P&L on 40 units = 40 * (120 - 105) = ₹600.00
    t3 = TradeEvent(
        trade_id="TR_3",
        order_id="ORD_3",
        symbol="TCS",
        side=Side.SELL,
        price=Decimal("120.00"),
        quantity=40,
        counterparty_order_id="CP_3",
        is_maker=False,
    )
    pos, pnl = pm.apply_trade(account_id, ProductType.MIS, t3)
    assert pos.quantity == 60
    assert pos.average_price == Decimal("105.00")  # Average price of remaining remains unchanged
    assert pnl == Decimal("600.00")
    assert pos.realized_pnl == Decimal("600.00")


def test_short_selling_and_covering():
    pm = PositionManager()
    account_id = "ACC_1"

    # Sell (Short) 100 @ ₹200
    t1 = TradeEvent(
        trade_id="TR_1",
        order_id="ORD_1",
        symbol="INFY",
        side=Side.SELL,
        price=Decimal("200.00"),
        quantity=100,
        counterparty_order_id="CP_1",
        is_maker=False,
    )
    pos, pnl = pm.apply_trade(account_id, ProductType.MIS, t1)
    assert pos.quantity == -100
    assert pos.average_price == Decimal("200.00")
    assert pnl == Decimal("0.00")

    # Cover (Buy) 100 @ ₹185 -> Realized P&L = 100 * (200 - 185) = ₹1,500.00
    t2 = TradeEvent(
        trade_id="TR_2",
        order_id="ORD_2",
        symbol="INFY",
        side=Side.BUY,
        price=Decimal("185.00"),
        quantity=100,
        counterparty_order_id="CP_2",
        is_maker=False,
    )
    pos, pnl = pm.apply_trade(account_id, ProductType.MIS, t2)
    assert pos.quantity == 0
    assert pnl == Decimal("1500.00")
    assert pos.realized_pnl == Decimal("1500.00")


def test_unrealized_mtm_calculation():
    pm = PositionManager()
    account_id = "ACC_1"

    # Long 100 @ ₹500
    t1 = TradeEvent(
        trade_id="TR_1",
        order_id="ORD_1",
        symbol="SBIN",
        side=Side.BUY,
        price=Decimal("500.00"),
        quantity=100,
        counterparty_order_id="CP_1",
        is_maker=False,
    )
    pos, _ = pm.apply_trade(account_id, ProductType.MIS, t1)

    # Market moves to ₹520 -> Unrealized MTM = 100 * (520 - 500) = ₹2,000.00
    pm.update_market_price("SBIN", Decimal("520.00"))
    assert pos.unrealized_pnl == Decimal("2000.00")

    # Market drops to ₹490 -> Unrealized MTM = 100 * (490 - 500) = -₹1,000.00
    pm.update_market_price("SBIN", Decimal("490.00"))
    assert pos.unrealized_pnl == Decimal("-1000.00")
