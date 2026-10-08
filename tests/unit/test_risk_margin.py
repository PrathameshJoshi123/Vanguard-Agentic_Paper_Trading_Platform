from decimal import Decimal
import pytest

from src.common.types import Side, OrderType, ProductType
from src.common.exceptions import InsufficientMarginError, InsufficientHoldingsError
from src.core.models import Order
from src.risk.margin import MarginCalculator
from src.risk.engine import PreTradeRiskEngine, AccountRiskState


def test_margin_calculator_cnc_vs_mis():
    calc = MarginCalculator()
    # CNC Buy 100 @ 100 -> ₹10,000 order value + estimated charges
    cnc_req = calc.calculate_margin(Side.BUY, ProductType.CNC, Decimal("100.00"), 100)
    assert cnc_req.order_value == Decimal("10000.00")
    assert cnc_req.base_margin == Decimal("10000.00")
    assert cnc_req.total_required_margin == Decimal("10000.00") + cnc_req.estimated_charges

    # MIS Buy 100 @ 100 -> 20% of ₹10,000 = ₹2,000 + ₹4.21 charges = ₹2,004.21
    mis_req = calc.calculate_margin(Side.BUY, ProductType.MIS, Decimal("100.00"), 100)
    assert mis_req.order_value == Decimal("10000.00")
    assert mis_req.base_margin == Decimal("2000.00")
    assert mis_req.estimated_charges == Decimal("4.21")
    assert mis_req.total_required_margin == Decimal("2004.21")


def test_pre_trade_margin_rejection():
    risk_engine = PreTradeRiskEngine()
    account = AccountRiskState(account_id="ACC_1", cash_balance=Decimal("1500.00"))

    order = Order(
        order_id="ORD_1",
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        price=Decimal("100.00"),
        quantity=100,
        product_type=ProductType.MIS,  # Requires ₹2004.21
    )

    with pytest.raises(InsufficientMarginError) as exc_info:
        risk_engine.validate_pre_trade(account, order)
    assert "Insufficient margin" in str(exc_info.value)


def test_pre_trade_cnc_short_selling_rejection():
    risk_engine = PreTradeRiskEngine()
    account = AccountRiskState(account_id="ACC_1", cash_balance=Decimal("100000.00"), holdings={"INFY": 10})

    order = Order(
        order_id="ORD_2",
        symbol="INFY",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        price=Decimal("1500.00"),
        quantity=20,  # Only 10 in holdings
        product_type=ProductType.CNC,
    )

    with pytest.raises(InsufficientHoldingsError) as exc_info:
        risk_engine.validate_pre_trade(account, order)
    assert "Insufficient holdings" in str(exc_info.value)


def test_margin_block_and_release_lifecycle():
    risk_engine = PreTradeRiskEngine()
    account = AccountRiskState(account_id="ACC_1", cash_balance=Decimal("10000.00"))

    order = Order(
        order_id="ORD_3",
        symbol="TCS",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        price=Decimal("100.00"),
        quantity=100,
        product_type=ProductType.MIS,
    )

    # Block margin
    req = risk_engine.block_margin_for_order(account, order)
    assert account.blocked_margin == Decimal("2004.21")
    assert account.available_margin == Decimal("10000.00") - Decimal("2004.21")

    # Release margin upon cancellation
    released = risk_engine.release_margin_for_order(account, "ORD_3", "TCS")
    assert released == Decimal("2004.21")
    assert account.blocked_margin == Decimal("0.00")
    assert account.available_margin == Decimal("10000.00")
